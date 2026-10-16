import { Router } from "express";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { firstColumnId, prisma, topOrder } from "../db.js";
import { csvCell, HttpError, olxTitle, parseCsv, phoneKey } from "../lib/text.js";

export const importExportRouter = Router();

const LINPHONE_DB =
  process.env.LINPHONE_DB ?? path.join(os.homedir(), "Library/Application Support/linphone/linphone.db");

type LinphoneContact = { linphoneId: number; name: string; phone: string; olxUrl: string };

/** Linphone bazasidagi vCard'larni o'qiydi (faqat o'qish rejimida). */
function readLinphone(): LinphoneContact[] {
  if (!fs.existsSync(LINPHONE_DB)) throw new HttpError(404, "Linphone bazasi topilmadi: " + LINPHONE_DB);
  const db = new DatabaseSync(LINPHONE_DB, { readOnly: true });
  try {
    const rows = db.prepare("SELECT id, v_card FROM friend WHERE v_card IS NOT NULL ORDER BY id").all() as {
      id: number;
      v_card: string;
    }[];
    return rows.map(({ id, v_card }) => {
      // vCard qatorlari bukilgan bo'lishi mumkin (keyingi qator bo'shliq bilan boshlanadi)
      const text = v_card.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
      const f: Record<string, string> = {};
      for (const line of text.split("\n")) {
        const i = line.indexOf(":");
        if (i < 0) continue;
        const key = line.slice(0, i).split(";")[0].toUpperCase();
        f[key] ??= line.slice(i + 1).trim();
      }
      return { linphoneId: id, name: f.FN ?? "", phone: f.TEL ?? "", olxUrl: f.ORG ?? "" };
    });
  } finally {
    db.close();
  }
}

/** Linphone'dagi yangi kontaktlarni birinchi ustunga qo'shadi. Avval olinganlar va bor raqamlar o'tkazib yuboriladi. */
importExportRouter.post("/import/linphone", async (_req, res) => {
  const contacts = readLinphone();
  const columnId = await firstColumnId();
  if (!columnId) throw new HttpError(400, "Avval ustun yarating");

  const imported = new Set((await prisma.linphoneImport.findMany({ select: { linphoneId: true } })).map((r) => r.linphoneId));
  const known = new Set((await prisma.lead.findMany({ select: { phoneKey: true } })).map((l) => l.phoneKey).filter(Boolean));

  let order = await topOrder(columnId);
  let added = 0;
  let duplicates = 0;
  for (const c of contacts.reverse()) {
    if (imported.has(c.linphoneId)) continue;
    const key = phoneKey(c.phone);
    if (key && known.has(key)) duplicates++;
    else {
      await prisma.lead.create({
        data: {
          ownerName: c.name,
          phone: c.phone,
          phoneKey: key,
          olxUrl: c.olxUrl,
          houseName: olxTitle(c.olxUrl),
          columnId,
          order,
          linphoneId: c.linphoneId,
        },
      });
      order -= 1000;
      added++;
      if (key) known.add(key);
    }
    await prisma.linphoneImport.create({ data: { linphoneId: c.linphoneId } });
  }
  res.json({ total: contacts.length, added, duplicates });
});

const CSV_HEAD = ["Ism", "Telefon", "Uy nomi", "OLX", "Rentmi", "Bosqich", "Qayta qo'ng'iroq", "Izoh", "O'zgartirilgan"];

importExportRouter.get("/export.csv", async (_req, res) => {
  const columns = await prisma.column.findMany({ orderBy: { order: "asc" }, include: { leads: { orderBy: { order: "asc" } } } });
  const rows = columns.flatMap((c) =>
    c.leads.map((l) =>
      [l.ownerName, l.phone, l.houseName, l.olxUrl, l.rentmeUrl, c.name, l.nextCall, l.note, l.updatedAt.toISOString().slice(0, 16).replace("T", " ")]
        .map(csvCell)
        .join(","),
    ),
  );
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="uy-egalari-${date}.csv"`);
  res.send("﻿" + [CSV_HEAD.map(csvCell).join(","), ...rows].join("\r\n"));
});

/**
 * Eski HTML doskadan (yoki shu saytdan) yuklab olingan CSV'ni import qiladi.
 * Raqami bor karta yangilanadi, yo'g'i yaratiladi; "Bosqich" nomidagi ustun bo'lmasa yaratiladi.
 */
importExportRouter.post("/import/csv", async (req, res) => {
  if (typeof req.body !== "string" || !req.body.trim()) throw new HttpError(400, "CSV fayl bo'sh");
  const [head, ...rows] = parseCsv(req.body);
  const idx = (name: string) => head.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const col = {
    name: idx("Ism"),
    phone: idx("Telefon"),
    house: idx("Uy nomi"),
    olx: idx("OLX"),
    rm: idx("Rentmi"),
    stage: idx("Bosqich"),
    next: idx("Qayta qo'ng'iroq"),
    note: idx("Izoh"),
  };
  if (col.name < 0 && col.phone < 0) throw new HttpError(400, "Bu fayl doska CSV'siga o'xshamaydi: «Ism» yoki «Telefon» ustuni yo'q");

  const columns = await prisma.column.findMany({ orderBy: { order: "asc" } });
  const byName = new Map(columns.map((c) => [c.name.trim().toLowerCase(), c.id]));
  let lastOrder = columns.at(-1)?.order ?? 0;
  const columnFor = async (name: string) => {
    const key = name.trim().toLowerCase();
    if (!key) return columns[0]?.id ?? (await prisma.column.create({ data: { name: "Yangi", order: (lastOrder += 1000) } })).id;
    let id = byName.get(key);
    if (!id) {
      id = (await prisma.column.create({ data: { name: name.trim(), color: byName.size % 6, order: (lastOrder += 1000) } })).id;
      byName.set(key, id);
    }
    return id;
  };

  let created = 0;
  let updated = 0;
  for (const r of rows) {
    const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    const phone = get(col.phone);
    const data = {
      ownerName: get(col.name),
      phone,
      phoneKey: phoneKey(phone),
      houseName: get(col.house),
      olxUrl: get(col.olx),
      rentmeUrl: get(col.rm),
      note: get(col.note),
      nextCall: /^\d{4}-\d{2}-\d{2}$/.test(get(col.next)) ? get(col.next) : "",
    };
    if (!data.ownerName && !data.phone && !data.olxUrl) continue;
    if (!data.houseName) data.houseName = olxTitle(data.olxUrl);
    const columnId = await columnFor(get(col.stage));
    const existing = data.phoneKey ? await prisma.lead.findFirst({ where: { phoneKey: data.phoneKey } }) : null;
    if (existing) {
      await prisma.lead.update({
        where: { id: existing.id },
        data: { ...data, columnId, order: existing.columnId === columnId ? existing.order : await topOrder(columnId) },
      });
      updated++;
    } else {
      await prisma.lead.create({ data: { ...data, columnId, order: await topOrder(columnId) } });
      created++;
    }
  }
  res.json({ created, updated });
});
