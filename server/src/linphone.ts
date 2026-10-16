import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { firstColumnId, prisma, topOrder } from "./db.js";
import { HttpError, olxTitle, phoneKey } from "./lib/text.js";

const LINPHONE_DB =
  process.env.LINPHONE_DB ?? path.join(os.homedir(), "Library/Application Support/linphone/linphone.db");
const WATCH_MS = Number(process.env.LINPHONE_WATCH_MS ?? 4000);

type LinphoneContact = { linphoneId: number; name: string; phone: string; olxUrl: string };
export type ImportResult = { total: number; added: number; duplicates: number; names: string[] };

/** Linphone bazasini faqat o'qish rejimida ochadi. */
function withLinphone<T>(fn: (db: DatabaseSync) => T): T {
  if (!fs.existsSync(LINPHONE_DB)) throw new HttpError(404, "Linphone bazasi topilmadi: " + LINPHONE_DB);
  const db = new DatabaseSync(LINPHONE_DB, { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

/** Linphone bazasidagi vCard'larni o'qiydi. */
function readContacts(): LinphoneContact[] {
  return withLinphone((db) => {
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
  });
}

/** Kontaktlar va qo'ng'iroqlar soni/oxirgi id — o'zgarish bo'lganini arzon aniqlash uchun. */
function signature(): string {
  return withLinphone((db) => {
    const f = db.prepare("SELECT count(*) AS c, max(id) AS m FROM friend").get() as { c: number; m: number | null };
    const c = db.prepare("SELECT count(*) AS c, max(id) AS m FROM conference_call").get() as { c: number; m: number | null };
    return `${f.c}:${f.m ?? 0}|${c.c}:${c.m ?? 0}`;
  });
}

// Linphone (liblinphone) LinphoneCallStatus qiymatlari
const CALL_STATUS = ["success", "aborted", "missed", "declined", "early_aborted", "accepted_elsewhere", "declined_elsewhere"];

/** "2026-10-16 08:55:42" (Linphone UTC'da saqlaydi) → Date */
const utc = (s: string | null) => (s ? new Date(s.replace(" ", "T") + "Z") : null);

/** sip:938029987@pbx.powerapp.uz → "938029987" */
const sipUser = (addr: string) => addr.replace(/^sips?:/i, "").split("@")[0];

let callsRunning: Promise<number> | null = null;

/** Linphone qo'ng'iroqlar tarixidan hali olinmagan qo'ng'iroqlarni bazaga yozadi. Yangi qo'ng'iroqlar sonini qaytaradi. */
export function importCalls(): Promise<number> {
  callsRunning ??= doImportCalls().finally(() => (callsRunning = null));
  return callsRunning;
}

async function doImportCalls(): Promise<number> {
  const last = await prisma.call.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  const rows = withLinphone(
    (db) =>
      db
        .prepare(
          `SELECT c.id, c.direction, c.status, c.duration, c.start_time, c.connected_time,
                  f.value AS from_addr, t.value AS to_addr
             FROM conference_call c
             JOIN sip_address f ON f.id = c.from_sip_address_id
             JOIN sip_address t ON t.id = c.to_sip_address_id
            WHERE c.id > ? ORDER BY c.id`,
        )
        .all(last?.id ?? 0) as {
        id: number;
        direction: number;
        status: number;
        duration: number | null;
        start_time: string;
        connected_time: string | null;
        from_addr: string;
        to_addr: string;
      }[],
  );
  if (!rows.length) return 0;
  await prisma.call.createMany({
    data: rows.map((r) => {
      const number = sipUser(r.direction === 1 ? r.from_addr : r.to_addr);
      return {
        id: r.id,
        direction: r.direction === 1 ? "in" : "out",
        status: CALL_STATUS[r.status] ?? "unknown",
        number,
        phoneKey: phoneKey(number),
        startedAt: utc(r.start_time)!,
        connectedAt: utc(r.connected_time),
        duration: r.duration ?? 0,
      };
    }),
  });
  return rows.length;
}

let running: Promise<ImportResult> | null = null;

/**
 * Linphone'dagi yangi kontaktlarni birinchi ustunga qo'shadi. Avval olinganlar va bor raqamlar o'tkazib yuboriladi.
 * Bir vaqtda faqat bitta import ishlaydi (qo'lda bosish va avtomatik tekshiruv to'qnashmasligi uchun).
 */
export function importLinphone(): Promise<ImportResult> {
  running ??= doImport().finally(() => (running = null));
  return running;
}

async function doImport(): Promise<ImportResult> {
  const contacts = readContacts();
  const columnId = await firstColumnId();
  if (!columnId) throw new HttpError(400, "Avval ustun yarating");

  const imported = new Set((await prisma.linphoneImport.findMany({ select: { linphoneId: true } })).map((r) => r.linphoneId));
  const known = new Set((await prisma.lead.findMany({ select: { phoneKey: true } })).map((l) => l.phoneKey).filter(Boolean));

  let order = await topOrder(columnId);
  const names: string[] = [];
  let duplicates = 0;
  for (const c of [...contacts].reverse()) {
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
      names.push(c.name);
      if (key) known.add(key);
    }
    await prisma.linphoneImport.create({ data: { linphoneId: c.linphoneId } });
  }
  return { total: contacts.length, added: names.length, duplicates, names: names.reverse() };
}

export type SyncResult = ImportResult & { calls: number };

/** Linphone bazasini har bir necha soniyada tekshiradi; yangi kontakt yoki qo'ng'iroq bo'lsa import qiladi. */
export function watchLinphone(onChange: (r: SyncResult) => void) {
  let last = "";
  let warned = false;
  const tick = async () => {
    try {
      const sig = signature();
      if (sig === last) return;
      last = sig;
      const r = await importLinphone();
      const calls = await importCalls();
      if (r.added || calls) onChange({ ...r, calls });
      warned = false;
    } catch (e) {
      last = ""; // keyingi safar qayta urinib ko'ramiz
      if (!warned) console.warn("Linphone kuzatuvi:", (e as Error).message);
      warned = true;
    }
  };
  tick();
  return setInterval(tick, WATCH_MS);
}
