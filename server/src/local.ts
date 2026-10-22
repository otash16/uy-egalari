import fs from "node:fs";
import { createSource } from "../../agent/src/softphone.js";
import type { Softphone, SyncResult } from "../../agent/src/types.js";
import { defaultLinphonePath } from "../../agent/src/linphone.js";
import { applySync } from "./sync.js";

/**
 * Server turgan kompyuterning o'z softphone'i — alohida agent kerak emas, shu jarayonda kuzatiladi.
 * OPERATOR va SOFTPHONE env orqali; berilmasa Linphone bazasi bo'lsa o'sha, operator "Otajon".
 */
const OPERATOR = process.env.OPERATOR ?? "Otajon";
const SOFTPHONE = (process.env.SOFTPHONE ?? (fs.existsSync(defaultLinphonePath()) ? "linphone" : "")) as Softphone | "";
const WATCH_MS = Number(process.env.SOFTPHONE_WATCH_MS ?? 4000);

const source = SOFTPHONE ? createSource(SOFTPHONE, process.env.SOFTPHONE_PATH) : null;
let afterCallId = 0;
let lastSig = "";

export const localOperator = source ? OPERATOR : null;

/** Lokal softphone'ni bir marta o'qib serverga yozadi (menyudagi tugma ham shuni chaqiradi). */
export async function syncLocal(): Promise<SyncResult> {
  if (!source) throw Object.assign(new Error("Bu kompyuterda softphone sozlanmagan (SOFTPHONE env)"), { status: 400 });
  const sig = source.signature();
  if (sig === lastSig) return { operator: OPERATOR, total: 0, added: 0, duplicates: 0, names: [], calls: 0, warnings: [] };
  const { contacts, calls, maxCallId } = source.read(afterCallId);
  const r = await applySync({ operator: OPERATOR, softphone: source.softphone, contacts, calls });
  lastSig = sig;
  afterCallId = Math.max(afterCallId, maxCallId);
  return r;
}

/** Har bir necha soniyada tekshiradi; yangi narsa bo'lsa onChange chaqiriladi. */
export function watchLocal(onChange: (r: SyncResult) => void) {
  if (!source) return null;
  console.log(`Lokal softphone: ${OPERATOR} — ${source.softphone} (${source.location})`);
  let warned = false;
  const tick = async () => {
    try {
      const r = await syncLocal();
      if (r.added || r.calls || r.warnings.length) onChange(r);
      warned = false;
    } catch (e) {
      lastSig = "";
      if (!warned) console.warn("Softphone kuzatuvi:", (e as Error).message);
      warned = true;
    }
  };
  tick();
  return setInterval(tick, WATCH_MS);
}
