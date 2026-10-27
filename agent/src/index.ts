/**
 * Uy egalari doskasi — softphone agenti.
 * Shu kompyuterdagi Linphone/MicroSIP tarixini kuzatadi va yangi kontakt/qo'ng'iroqlarni serverga yuboradi.
 *
 *   config.json:  { "server": "http://192.168.1.10:4100", "operator": "Akbar", "softphone": "microsip", "path": "" }
 *   ishga tushirish:  yarn start   (yoki  npx tsx src/index.ts)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSource } from "./softphone.js";
import type { Softphone, SyncPayload, SyncResult } from "./types.js";

type Config = { server: string; operator: string; softphone: Softphone; path?: string; intervalMs?: number };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = process.env.AGENT_CONFIG ?? path.join(root, "config.json");

function loadConfig(): Config {
  if (!fs.existsSync(configPath)) {
    console.error(`config.json topilmadi: ${configPath}\nconfig.example.json dan nusxa olib to'ldiring.`);
    process.exit(1);
  }
  const c = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<Config>;
  if (!c.server || !c.operator || !c.softphone) {
    console.error("config.json da server, operator va softphone bo'lishi shart");
    process.exit(1);
  }
  return { ...c, server: c.server.replace(/\/+$/, "") } as Config;
}

const cfg = loadConfig();
const source = createSource(cfg.softphone, cfg.path);
const INTERVAL = cfg.intervalMs ?? 4000;
const HEARTBEAT = 60_000;
const stateFile = path.join(root, `.state-${cfg.operator.replace(/[^\w-]+/g, "_")}.json`);

let afterCallId = 0;
try {
  afterCallId = Number(JSON.parse(fs.readFileSync(stateFile, "utf8")).afterCallId) || 0;
} catch {}

let lastSig = "";
let lastSent = 0;
let warned = "";

async function send(payload: SyncPayload): Promise<SyncResult> {
  const res = await fetch(cfg.server + "/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw new Error(data?.error ?? `Server ${res.status}`);
  return data as SyncResult;
}

const time = () => new Date().toLocaleTimeString("uz-UZ", { hour12: false });

async function tick() {
  try {
    const sig = source.signature();
    const changed = sig !== lastSig;
    if (!changed && Date.now() - lastSent < HEARTBEAT) return;
    const { contacts, calls, maxCallId } = changed ? source.read(afterCallId) : { contacts: [], calls: [], maxCallId: afterCallId };
    const r = await send({ operator: cfg.operator, softphone: cfg.softphone, contacts, calls });
    lastSig = sig;
    lastSent = Date.now();
    if (maxCallId > afterCallId) {
      afterCallId = maxCallId;
      fs.writeFileSync(stateFile, JSON.stringify({ afterCallId }));
    }
    if (r.added || r.calls) console.log(`${time()}  +${r.added} kontakt, +${r.calls} qo'ng'iroq${r.names.length ? " — " + r.names.join(", ") : ""}`);
    for (const w of r.warnings) {
      const who = w.lead.operator || "boshqa operator";
      console.log(
        `${time()}  DIQQAT: ${w.number} — ${w.lead.ownerName || "Ismsiz"} (${w.lead.columnName}) ${who}ning kartasi!` +
          (w.lastCall ? ` Oxirgi qo'ng'iroq: ${w.lastCall.operator}, ${new Date(w.lastCall.startedAt).toLocaleString("uz-UZ")}` : ""),
      );
    }
    if (warned) {
      console.log(`${time()}  Server bilan aloqa tiklandi`);
      warned = "";
    }
  } catch (e) {
    lastSig = ""; // keyingi safar qayta o'qib yuboramiz
    const msg = (e as Error).message;
    if (msg !== warned) console.warn(`${time()}  Xato: ${msg}`);
    warned = msg;
  }
}

console.log(`Uy egalari agenti — operator: ${cfg.operator}, ${source.softphone} (${source.location}) → ${cfg.server}`);
tick();
setInterval(tick, INTERVAL);
