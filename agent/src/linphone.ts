import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Source, SyncCall, SyncContact } from "./types.js";

/** Linphone (macOS) bazasining odatiy manzili. */
export function defaultLinphonePath() {
  if (process.platform === "win32") return path.join(process.env.APPDATA ?? "", "linphone", "linphone.db");
  if (process.platform === "darwin") return path.join(os.homedir(), "Library/Application Support/linphone/linphone.db");
  return path.join(os.homedir(), ".local/share/linphone/linphone.db");
}

// Linphone (liblinphone) LinphoneCallStatus qiymatlari
const CALL_STATUS = ["success", "aborted", "missed", "declined", "early_aborted", "accepted_elsewhere", "declined_elsewhere"];

/** "2026-10-16 08:55:42" (Linphone UTC'da saqlaydi) → ISO */
const utc = (s: string | null) => (s ? new Date(s.replace(" ", "T") + "Z").toISOString() : null);

/** sip:938029987@pbx.powerapp.uz → "938029987" */
const sipUser = (addr: string) => addr.replace(/^sips?:/i, "").split("@")[0];

/** vCard matnidan FN/TEL/ORG maydonlarini oladi. */
function parseVCard(v_card: string) {
  // vCard qatorlari bukilgan bo'lishi mumkin (keyingi qator bo'shliq bilan boshlanadi)
  const text = v_card.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const f: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).split(";")[0].toUpperCase();
    f[key] ??= line.slice(i + 1).trim();
  }
  return f;
}

export function linphoneSource(dbPath = defaultLinphonePath()): Source {
  function withDb<T>(fn: (db: DatabaseSync) => T): T {
    if (!fs.existsSync(dbPath)) throw new Error("Linphone bazasi topilmadi: " + dbPath);
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      return fn(db);
    } finally {
      db.close();
    }
  }

  return {
    softphone: "linphone",
    location: dbPath,
    signature: () =>
      withDb((db) => {
        const f = db.prepare("SELECT count(*) AS c, max(id) AS m FROM friend").get() as { c: number; m: number | null };
        const c = db.prepare("SELECT count(*) AS c, max(id) AS m FROM conference_call").get() as { c: number; m: number | null };
        return `${f.c}:${f.m ?? 0}|${c.c}:${c.m ?? 0}`;
      }),
    read: (afterCallId) =>
      withDb((db) => {
        const friends = db.prepare("SELECT id, v_card FROM friend WHERE v_card IS NOT NULL ORDER BY id").all() as { id: number; v_card: string }[];
        const contacts: SyncContact[] = friends.map(({ id, v_card }) => {
          const f = parseVCard(v_card);
          // Linphone'da OLX havolasi "Kompaniya" (ORG) maydoniga yoziladi
          return { extId: String(id), name: f.FN ?? "", phone: f.TEL ?? "", olxUrl: f.ORG ?? "" };
        });
        const rows = db
          .prepare(
            `SELECT c.id, c.direction, c.status, c.duration, c.start_time, c.connected_time,
                    f.value AS from_addr, t.value AS to_addr
               FROM conference_call c
               JOIN sip_address f ON f.id = c.from_sip_address_id
               JOIN sip_address t ON t.id = c.to_sip_address_id
              WHERE c.id > ? ORDER BY c.id`,
          )
          .all(afterCallId) as {
          id: number;
          direction: number;
          status: number;
          duration: number | null;
          start_time: string;
          connected_time: string | null;
          from_addr: string;
          to_addr: string;
        }[];
        const calls: SyncCall[] = rows.map((r) => ({
          extId: String(r.id),
          direction: r.direction === 1 ? "in" : "out",
          status: CALL_STATUS[r.status] ?? "unknown",
          number: sipUser(r.direction === 1 ? r.from_addr : r.to_addr),
          startedAt: utc(r.start_time)!,
          connectedAt: utc(r.connected_time),
          duration: r.duration ?? 0,
        }));
        return { contacts, calls, maxCallId: rows.length ? rows[rows.length - 1].id : afterCallId };
      }),
  };
}
