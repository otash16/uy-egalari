import { firstColumnId, prisma, topOrder } from "./db.js";
import { HttpError, olxTitle, phoneKey } from "./lib/text.js";
import type { SyncPayload, SyncResult, SyncWarning } from "../../agent/src/types.js";

export type { SyncPayload, SyncResult, SyncWarning };

const SOFTPHONES = new Set(["linphone", "microsip"]);

/** Operator nomini tozalaydi va bazada bo'lishini ta'minlaydi (yo'q bo'lsa yaratadi). */
export async function ensureOperator(rawName: unknown, softphone?: string) {
  const name = String(rawName ?? "").trim().slice(0, 40);
  if (!name) throw new HttpError(400, "Operator nomi bo'sh");
  const count = await prisma.operator.count();
  const existing = await prisma.operator.findUnique({ where: { name } });
  if (existing) {
    if (softphone && softphone !== existing.softphone) await prisma.operator.update({ where: { name }, data: { softphone } });
    return existing;
  }
  return prisma.operator.create({ data: { name, color: (count + 1) % 6, softphone: softphone ?? "" } });
}

/** Payload'ni tekshiradi; noto'g'ri bo'lsa 400 qaytaradi. */
function validate(body: any): SyncPayload {
  if (!body || typeof body !== "object") throw new HttpError(400, "Sync ma'lumoti yo'q");
  if (!SOFTPHONES.has(body.softphone)) throw new HttpError(400, "softphone linphone yoki microsip bo'lishi kerak");
  const str = (v: unknown, max = 1000) => String(v ?? "").trim().slice(0, max);
  const contacts = Array.isArray(body.contacts)
    ? body.contacts.filter((c: any) => c && str(c.extId)).map((c: any) => ({ extId: str(c.extId, 64), name: str(c.name), phone: str(c.phone, 64), olxUrl: str(c.olxUrl) }))
    : [];
  const calls = Array.isArray(body.calls)
    ? body.calls
        .filter((c: any) => c && str(c.extId) && !Number.isNaN(new Date(c.startedAt).getTime()))
        .map((c: any) => ({
          extId: str(c.extId, 64),
          direction: c.direction === "in" ? ("in" as const) : ("out" as const),
          status: str(c.status, 32) || "unknown",
          number: str(c.number, 64),
          startedAt: new Date(c.startedAt).toISOString(),
          connectedAt: c.connectedAt && !Number.isNaN(new Date(c.connectedAt).getTime()) ? new Date(c.connectedAt).toISOString() : null,
          duration: Math.max(0, Number(c.duration) || 0),
        }))
    : [];
  return { operator: str(body.operator, 40), softphone: body.softphone, contacts, calls };
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Agentdan kelgan kontakt va qo'ng'iroqlarni bazaga yozadi.
 * Navbat bilan — ikki agent va qo'lda bosish bir vaqtda kelsa to'qnashmaydi.
 */
export function applySync(body: unknown): Promise<SyncResult> {
  const payload = validate(body);
  const run = async () => {
    const op = await ensureOperator(payload.operator, payload.softphone);
    const r = await doApply({ ...payload, operator: op.name });
    await prisma.operator.update({ where: { name: op.name }, data: { lastSyncAt: new Date() } });
    return r;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

async function doApply(p: SyncPayload): Promise<SyncResult> {
  const warnings: SyncWarning[] = [];
  const columns = await prisma.column.findMany({ select: { id: true, name: true } });
  const colName = (id: string) => columns.find((c) => c.id === id)?.name ?? "—";

  /** Shu raqamga tegishli boshqa operatorning kartasi bo'lsa ogohlantirish yasaydi. */
  async function warnIfForeign(kind: SyncWarning["kind"], number: string, key: string) {
    if (!key) return;
    const lead = await prisma.lead.findFirst({ where: { phoneKey: key }, orderBy: { updatedAt: "desc" } });
    if (!lead || !lead.operator || lead.operator === p.operator) return;
    if (warnings.some((w) => w.lead.id === lead.id && w.kind === kind)) return;
    const last = await prisma.call.findFirst({ where: { phoneKey: key, operator: { not: p.operator } }, orderBy: { startedAt: "desc" } });
    warnings.push({
      kind,
      operator: p.operator,
      number,
      lead: { id: lead.id, ownerName: lead.ownerName, operator: lead.operator, columnName: colName(lead.columnId) },
      lastCall: last ? { operator: last.operator, startedAt: last.startedAt.toISOString(), status: last.status } : null,
    });
  }

  // --- kontaktlar → yangi kartalar (birinchi ustunga)
  let added = 0;
  let duplicates = 0;
  const names: string[] = [];
  if (p.contacts.length) {
    const columnId = await firstColumnId();
    if (!columnId) throw new HttpError(400, "Avval ustun yarating");
    const imported = new Set(
      (await prisma.contactImport.findMany({ where: { operator: p.operator }, select: { extId: true } })).map((r) => r.extId),
    );
    const known = new Set((await prisma.lead.findMany({ select: { phoneKey: true } })).map((l) => l.phoneKey).filter(Boolean));
    let order = await topOrder(columnId);
    // Softphone'da oxirgi qo'shilgan kontakt doskada eng tepada bo'lsin
    for (const c of [...p.contacts].reverse()) {
      if (imported.has(c.extId)) continue;
      const key = phoneKey(c.phone);
      if (key && known.has(key)) {
        duplicates++;
        await warnIfForeign("contact", c.phone, key);
      } else {
        await prisma.lead.create({
          data: {
            ownerName: c.name,
            phone: c.phone,
            phoneKey: key,
            olxUrl: c.olxUrl,
            houseName: olxTitle(c.olxUrl),
            operator: p.operator,
            extId: c.extId,
            columnId,
            order,
          },
        });
        order -= 1000;
        added++;
        names.push(c.name || c.phone);
        if (key) known.add(key);
      }
      await prisma.contactImport.create({ data: { operator: p.operator, extId: c.extId } });
    }
  }

  // --- qo'ng'iroqlar (SQLite'da skipDuplicates yo'q — o'zimiz filtrlaymiz)
  // Softphone qo'ng'iroq boshlanishida "aborted, 0s" deb yozib, tugagach yangilaydi — shuning uchun
  // mavjud yozuvning status/davomiyligi o'zgargan bo'lsa yangilab qo'yamiz.
  let newCalls = 0;
  if (p.calls.length) {
    const have = new Map(
      (
        await prisma.call.findMany({
          where: { operator: p.operator, extId: { in: p.calls.map((c) => c.extId) } },
          select: { id: true, extId: true, status: true, duration: true, connectedAt: true },
        })
      ).map((c) => [c.extId, c]),
    );
    const fresh = p.calls.filter((c) => !have.has(c.extId));
    for (const c of p.calls) {
      const old = have.get(c.extId);
      if (!old) continue;
      const connectedAt = c.connectedAt ? new Date(c.connectedAt) : null;
      const changed = old.status !== c.status || old.duration !== c.duration || (old.connectedAt?.getTime() ?? null) !== (connectedAt?.getTime() ?? null);
      if (changed) await prisma.call.update({ where: { id: old.id }, data: { status: c.status, duration: c.duration, connectedAt } });
    }
    if (fresh.length) {
      await prisma.call.createMany({
        data: fresh.map((c) => ({
          operator: p.operator,
          extId: c.extId,
          direction: c.direction,
          status: c.status,
          number: c.number,
          phoneKey: phoneKey(c.number),
          startedAt: new Date(c.startedAt),
          connectedAt: c.connectedAt ? new Date(c.connectedAt) : null,
          duration: c.duration,
        })),
      });
      newCalls = fresh.length;
      // Boshqa operatorning uy egasiga qo'ng'iroq qilingan bo'lsa — ogohlantirish
      const recent = Date.now() - 3 * 24 * 3600 * 1000;
      for (const c of fresh) if (c.direction === "out" && new Date(c.startedAt).getTime() > recent) await warnIfForeign("call", c.number, phoneKey(c.number));
    }
  }

  return { operator: p.operator, total: p.contacts.length, added, duplicates, names: names.reverse(), calls: newCalls, warnings };
}
