import fs from "node:fs";
import { prisma } from "./db.js";
import { applySync } from "./sync.js";
import type { SyncCall, SyncResult } from "../../agent/src/types.js";

/**
 * Asterisk (pbx.powerapp.uz) qo'ng'iroq jurnali — cdr-csv/Master.csv.
 * Doska shu server bilan bitta mashinada turadi, fayl konteynerga faqat o'qish uchun ulanadi.
 * Operatorning kompyuterida agent kerak emas: har bir qo'ng'iroq tugagach Asterisk o'zi qator yozadi.
 *
 * ASTERISK_CDR        — fayl yo'li (Docker: /asterisk/Master.csv). Bo'sh = o'chirilgan.
 * ASTERISK_EXTENSIONS — "101:Otajon,102:Akbar" — ichki raqam → Operator.name.
 * ASTERISK_SINCE      — shu sanadan eski qatorlar o'qilmaydi (agentlar davridagi tarix takrorlanmasin).
 */
const CDR_PATH = process.env.ASTERISK_CDR ?? "";
const WATCH_MS = Number(process.env.ASTERISK_WATCH_MS ?? 4000);
const SINCE = new Date(process.env.ASTERISK_SINCE ?? "2026-10-28T00:00:00Z");

export const extensionMap: Map<string, string> = new Map(
  (process.env.ASTERISK_EXTENSIONS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [ext, name] = s.split(":").map((x) => x.trim());
      return [ext, name] as [string, string];
    })
    .filter(([ext, name]) => ext && name),
);

/** Shu operatorning qo'ng'iroqlari Asterisk'dan keladi — agent yuborganlari e'tiborsiz qoldiriladi (takror bo'lmasin). */
export function callsFromAsterisk(operator: string): boolean {
  return !!CDR_PATH && [...extensionMap.values()].includes(operator);
}

/** Asterisk cdr-csv ustunlari (standart tartib). */
export type CdrRow = {
  accountcode: string; src: string; dst: string; dcontext: string; clid: string; channel: string; dstchannel: string;
  lastapp: string; lastdata: string; start: string; answer: string; end: string; duration: number; billsec: number;
  disposition: string; amaflags: string; uniqueid: string; userfield: string;
};

/** CSV satrini ustunlarga ajratadi: qo'shtirnoq ichida vergul va "" bo'lishi mumkin. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseCdrLine(line: string): CdrRow | null {
  const f = splitCsvLine(line.replace(/\r$/, ""));
  if (f.length < 17) return null;
  return {
    accountcode: f[0], src: f[1], dst: f[2], dcontext: f[3], clid: f[4], channel: f[5], dstchannel: f[6], lastapp: f[7], lastdata: f[8],
    start: f[9], answer: f[10], end: f[11], duration: Number(f[12]) || 0, billsec: Number(f[13]) || 0,
    disposition: f[14], amaflags: f[15], uniqueid: f[16], userfield: f[17] ?? "",
  };
}

/** "PJSIP/102-000000c7" → "102" */
export function channelExt(channel: string): string {
  const m = channel.match(/^(?:PJSIP|SIP)\/([^-@]+)/);
  return m ? m[1] : "";
}

/** Asterisk vaqtlari UTC'da, zonasiz: "2026-10-28 09:00:54" */
function utc(s: string): string | null {
  if (!s) return null;
  const d = new Date(s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function status(disposition: string, direction: "in" | "out"): string {
  switch (disposition) {
    case "ANSWERED": return "success";
    case "NO ANSWER": return direction === "in" ? "missed" : "aborted";
    case "BUSY": return "declined";
    case "FAILED": return "unknown";
    default: return "unknown";
  }
}

/** Bitta CDR qatorini operator + qo'ng'iroqqa aylantiradi; bizning ichki raqamlarga tegishli bo'lmasa null. */
export function toCall(r: CdrRow, exts: Map<string, string> = extensionMap): { operator: string; call: SyncCall } | null {
  const startedAt = utc(r.start);
  if (!startedAt || !r.uniqueid) return null;
  const srcExt = channelExt(r.channel);
  const dstExt = channelExt(r.dstchannel);
  let operator = "";
  let direction: "in" | "out" = "out";
  let number = "";
  if (srcExt && exts.has(srcExt)) {
    // Ofisdan tashqariga: kanal bizning ichki raqam, dst — qarshi tomon
    operator = exts.get(srcExt)!;
    direction = "out";
    number = r.dst;
  } else if (dstExt && exts.has(dstExt)) {
    // Tashqaridan ichki raqamga: dstchannel bizning ichki raqam, src — qarshi tomon
    operator = exts.get(dstExt)!;
    direction = "in";
    number = r.src;
  } else if (exts.has(r.dst) && r.dcontext !== "from-internal") {
    // Kiruvchi, lekin javob berilmagan (dstchannel bo'sh): dst ichki raqam
    operator = exts.get(r.dst)!;
    direction = "in";
    number = r.src;
  } else return null;
  // Ichki (ofis ichidagi) qo'ng'iroqlar doskaga kerak emas
  if (exts.has(number)) return null;
  return {
    operator,
    call: {
      extId: "ast:" + r.uniqueid,
      direction,
      status: status(r.disposition, direction),
      number,
      startedAt,
      connectedAt: utc(r.answer),
      duration: r.billsec,
    },
  };
}

let offset = 0;
let lastSize = -1;
let lastMtime = 0;
let carry = "";

/** Faylning o'qilmagan qismini qaytaradi (append-only; qisqarsa boshidan). */
function readNew(): string {
  const st = fs.statSync(CDR_PATH);
  if (st.size === lastSize && st.mtimeMs === lastMtime) return "";
  if (st.size < offset) { offset = 0; carry = ""; }
  lastSize = st.size;
  lastMtime = st.mtimeMs;
  if (st.size === offset) return "";
  const fd = fs.openSync(CDR_PATH, "r");
  try {
    const buf = Buffer.alloc(st.size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
    offset = st.size;
    return buf.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Agentlar davrida yozilgan qo'ng'iroq bilan ustma-ust tushsa (shu operator, shu raqam, ±2 daqiqa) o'tkazib yuboradi —
 * Asterisk va softphone bitta qo'ng'iroqni har xil id bilan beradi.
 */
async function dropAgentDuplicates(items: { operator: string; call: SyncCall }[]) {
  const out: typeof items = [];
  for (const it of items) {
    const t = new Date(it.call.startedAt).getTime();
    const key = it.call.number.replace(/\D/g, "").replace(/^998(?=\d{9}$)/, "");
    const dup = await prisma.call.findFirst({
      where: {
        operator: it.operator,
        phoneKey: key,
        extId: { not: { startsWith: "ast:" } },
        startedAt: { gte: new Date(t - 120_000), lte: new Date(t + 120_000) },
      },
      select: { id: true },
    });
    if (!dup) out.push(it);
  }
  return out;
}

/** Faylni bir marta o'qib, yangi qatorlarni bazaga yozadi. Operator bo'yicha natijalar. */
export async function syncAsterisk(): Promise<SyncResult[]> {
  const chunk = readNew();
  if (!chunk) return [];
  const text = carry + chunk;
  const lines = text.split("\n");
  carry = lines.pop() ?? ""; // oxirgi tugallanmagan satr keyingi safarga
  const items: { operator: string; call: SyncCall }[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = parseCdrLine(line);
    if (!row) continue;
    const it = toCall(row);
    if (!it || new Date(it.call.startedAt) < SINCE) continue;
    items.push(it);
  }
  const byOp = new Map<string, SyncCall[]>();
  for (const it of await dropAgentDuplicates(items)) byOp.set(it.operator, [...(byOp.get(it.operator) ?? []), it.call]);
  const results: SyncResult[] = [];
  for (const [operator, calls] of byOp) results.push(await applySync({ operator, softphone: "asterisk", contacts: [], calls }));
  return results;
}

/** Har bir necha soniyada faylni tekshiradi; yangi qo'ng'iroq bo'lsa onChange. */
export function watchAsterisk(onChange: (r: SyncResult) => void) {
  if (!CDR_PATH) return null;
  if (!extensionMap.size) {
    console.warn("ASTERISK_CDR berilgan, lekin ASTERISK_EXTENSIONS bo'sh — qo'ng'iroqlar o'qilmaydi");
    return null;
  }
  console.log(`Asterisk CDR: ${CDR_PATH} — ${[...extensionMap].map(([e, n]) => `${e}→${n}`).join(", ")} (${SINCE.toISOString().slice(0, 10)} dan)`);
  let warned = false;
  const tick = async () => {
    try {
      for (const r of await syncAsterisk()) if (r.calls || r.warnings.length) onChange(r);
      // Fayl o'qilyapti — doskada operator chipidagi "ulangan" nuqtasi yonib tursin
      await prisma.operator.updateMany({ where: { name: { in: [...new Set(extensionMap.values())] } }, data: { lastSyncAt: new Date() } });
      warned = false;
    } catch (e) {
      lastSize = -1;
      if (!warned) console.warn("Asterisk CDR:", (e as Error).message);
      warned = true;
    }
  };
  tick();
  return setInterval(tick, WATCH_MS);
}
