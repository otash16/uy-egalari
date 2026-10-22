import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Source, SyncCall, SyncContact } from "./types.js";

/**
 * MicroSIP (Windows) ma'lumotlar papkasi.
 * O'rnatilgan versiya: %APPDATA%\MicroSIP\ ; portable: microsip.exe yonidagi papka.
 * 3.21+ : call_log.db va contacts.db (SQLite). Eski versiyalar: microsip.ini [Calls] va Contacts.xml.
 */
export function defaultMicrosipDir() {
  return path.join(process.env.APPDATA ?? "", "MicroSIP");
}

// MicroSIP: enum { MSIP_CALL_TYPE_OUTGOING, MSIP_CALL_TYPE_INCOMING, MSIP_CALL_TYPE_MISSED, MSIP_CALL_TYPE_AE }
const TYPE_OUT = 0;
const TYPE_IN = 1;
const TYPE_MISSED = 2;
const TYPE_AE = 3;

type RawCall = { id: number; number: string; type: number; time: number; duration: number };

function toSyncCall(r: RawCall): SyncCall {
  const direction = r.type === TYPE_OUT ? "out" : "in";
  let status = "unknown";
  if (r.type === TYPE_OUT) status = r.duration > 0 ? "success" : "aborted";
  else if (r.type === TYPE_IN) status = "success";
  else if (r.type === TYPE_MISSED) status = "missed";
  else if (r.type === TYPE_AE) status = "accepted_elsewhere";
  const startedAt = new Date(r.time * 1000).toISOString();
  return {
    extId: String(r.id),
    direction,
    status,
    // "998901234567@pbx.example.uz" bo'lishi mumkin — faqat user qismi
    number: r.number.replace(/^sips?:/i, "").split("@")[0],
    startedAt,
    connectedAt: status === "success" ? startedAt : null,
    duration: r.duration > 0 ? r.duration : 0,
  };
}

/** microsip.ini [Calls] bo'limi: N=number;name;type;time;duration;info (eski versiyalar) */
function readIniCalls(iniPath: string, afterCallId: number): RawCall[] {
  const text = fs.readFileSync(iniPath, "utf8").replace(/^﻿/, "");
  const m = text.match(/^\[Calls\]\r?\n([\s\S]*?)(?=^\[|$(?![\r\n]))/m);
  if (!m) return [];
  const out: RawCall[] = [];
  for (const line of m[1].split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const id = Number(line.slice(0, eq));
    const val = line.slice(eq + 1);
    if (!Number.isInteger(id) || id <= afterCallId || val === "null") continue;
    const [number, , type, time, duration] = val.split(";");
    if (!number) continue;
    out.push({ id, number, type: Number(type) || 0, time: Number(time) || 0, duration: Number(duration) || 0 });
  }
  return out.sort((a, b) => a.id - b.id);
}

/** Contacts.xml: <contact name="" number="" info="" .../> (eski versiyalar) */
function readXmlContacts(xmlPath: string): SyncContact[] {
  const text = fs.readFileSync(xmlPath, "utf8");
  const out: SyncContact[] = [];
  const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  for (const tag of text.match(/<contact\b[^>]*\/?>/g) ?? []) {
    const attr = (n: string) => unesc(tag.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1] ?? "");
    const number = attr("number");
    if (!number) continue;
    out.push({ extId: attr("id") || number, name: attr("name"), phone: number, olxUrl: attr("info") || attr("comment") });
  }
  return out;
}

function withDb<T>(file: string, fn: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

export function microsipSource(dir = defaultMicrosipDir()): Source {
  const callsDb = path.join(dir, "call_log.db");
  const contactsDb = path.join(dir, "contacts.db");
  const ini = path.join(dir, "microsip.ini");
  const contactsXml = path.join(dir, "Contacts.xml");

  const check = () => {
    if (!fs.existsSync(callsDb) && !fs.existsSync(ini)) throw new Error("MicroSIP ma'lumotlari topilmadi: " + dir);
  };

  return {
    softphone: "microsip",
    location: dir,
    signature() {
      check();
      const parts: string[] = [];
      if (fs.existsSync(callsDb)) {
        const c = withDb(callsDb, (db) => db.prepare("SELECT count(*) AS c, max(id) AS m FROM call_log").get() as { c: number; m: number | null });
        parts.push(`db:${c.c}:${c.m ?? 0}`);
      } else {
        const st = fs.statSync(ini);
        parts.push(`ini:${st.size}:${st.mtimeMs}`);
      }
      for (const f of [contactsDb, contactsXml]) if (fs.existsSync(f)) parts.push(`${path.basename(f)}:${fs.statSync(f).mtimeMs}`);
      return parts.join("|");
    },
    read(afterCallId) {
      check();
      let raw: RawCall[];
      if (fs.existsSync(callsDb)) {
        raw = withDb(callsDb, (db) =>
          (db.prepare("SELECT id, number, type, time, duration FROM call_log WHERE id > ? ORDER BY id").all(afterCallId) as any[]).map((r) => ({
            id: Number(r.id),
            number: String(r.number ?? ""),
            type: Number(r.type ?? 0),
            time: Number(r.time ?? 0),
            duration: Number(r.duration ?? 0),
          })),
        );
      } else raw = readIniCalls(ini, afterCallId);
      const calls = raw.filter((r) => r.time > 0 && r.number).map(toSyncCall);

      let contacts: SyncContact[] = [];
      if (fs.existsSync(contactsDb)) {
        contacts = withDb(contactsDb, (db) => {
          const cols = new Set((db.prepare("PRAGMA table_info(contacts)").all() as { name: string }[]).map((c) => c.name));
          if (!cols.has("number")) return [];
          return (db.prepare("SELECT * FROM contacts ORDER BY id").all() as Record<string, unknown>[]).map((r) => ({
            extId: String(r.id ?? r.number),
            name: String(r.name ?? ""),
            phone: String(r.number ?? ""),
            // OLX havolasi "info" yoki "comment" maydoniga yozilsa kartaga tushadi
            olxUrl: String(r.info ?? r.comment ?? ""),
          }));
        });
      } else if (fs.existsSync(contactsXml)) contacts = readXmlContacts(contactsXml);

      return { contacts, calls, maxCallId: raw.length ? raw[raw.length - 1].id : afterCallId };
    },
  };
}
