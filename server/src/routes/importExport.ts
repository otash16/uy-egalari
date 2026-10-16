import { Router } from "express";
import { prisma, topOrder } from "../db.js";
import { importCalls, importLinphone } from "../linphone.js";
import { csvCell, HttpError, olxTitle, parseCsv, phoneKey } from "../lib/text.js";

export const importExportRouter = Router();

/** Linphone'dagi yangi kontaktlarni qo'lda import qilish (menyudagi tugma). */
importExportRouter.post("/import/linphone", async (_req, res) => {
  const r = await importLinphone();
  res.json({ ...r, calls: await importCalls() });
});

const CSV_HEAD = ["Ism", "Telefon", "Uy nomi", "OLX", "Rentmi", "Bosqich", "Natija", "Qayta qo'ng'iroq", "Izoh", "O'zgartirilgan"];
const RESULT_LABELS: Record<string, string> = { no_answer: "Javob bermadi", talked: "Gaplashildi", declined: "Rad etdi" };
const resultFromLabel = (label: string) =>
  Object.entries(RESULT_LABELS).find(([, v]) => v.toLowerCase() === label.trim().toLowerCase())?.[0] ?? "";

importExportRouter.get("/export.csv", async (_req, res) => {
  const columns = await prisma.column.findMany({ orderBy: { order: "asc" }, include: { leads: { orderBy: { order: "asc" } } } });
  const rows = columns.flatMap((c) =>
    c.leads.map((l) =>
      [l.ownerName, l.phone, l.houseName, l.olxUrl, l.rentmeUrl, c.name, RESULT_LABELS[l.callResult] ?? "", l.nextCall, l.note, l.updatedAt.toISOString().slice(0, 16).replace("T", " ")]
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
    result: idx("Natija"),
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
      ...(col.result >= 0 ? { callResult: resultFromLabel(get(col.result)) } : {}),
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
