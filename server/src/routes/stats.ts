import { Router } from "express";
import { prisma } from "../db.js";

/**
 * Boshliqlar dashboardi uchun jonli statistika (GET /api/stats).
 * Hamma hisob Prisma'dan olingan qatorlar ustida JS'da — baza kichik (yuzlab karta/qo'ng'iroq).
 */
export const statsRouter = Router();

const TZ = "Asia/Tashkent";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false });
const dayOf = (d: Date) => dayFmt.format(d); // YYYY-MM-DD
const hourOf = (d: Date) => Number(hourFmt.format(d)) % 24;

const isTalk = (c: { status: string; duration: number }) => c.status === "success" && c.duration > 0;

statsRouter.get("/stats", async (_req, res) => {
  const [columns, leads, calls, operators] = await Promise.all([
    prisma.column.findMany({ orderBy: { order: "asc" } }),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.call.findMany({ orderBy: { startedAt: "asc" } }),
    prisma.operator.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  // Raqam bo'yicha qo'ng'iroqlar — kartaga bog'lash uchun
  const callsByKey = new Map<string, typeof calls>();
  for (const c of calls) {
    if (!c.phoneKey) continue;
    const arr = callsByKey.get(c.phoneKey) ?? [];
    arr.push(c);
    callsByKey.set(c.phoneKey, arr);
  }
  const leadCalls = (l: { phoneKey: string }) => (l.phoneKey ? callsByKey.get(l.phoneKey) ?? [] : []);

  const colName = new Map(columns.map((c) => [c.id, c.name]));
  const isPlaced = (name: string) => /^Rentmi/i.test(name);
  const isTenant = (name: string) => /^Gaplashildi/i.test(name);

  const leadsCalled = leads.filter((l) => leadCalls(l).length > 0).length;
  const leadsTalked = leads.filter((l) => leadCalls(l).some(isTalk)).length;
  const successCalls = calls.filter((c) => c.status === "success");
  const talkSeconds = calls.reduce((s, c) => s + c.duration, 0);
  const talked = calls.filter(isTalk);

  const summary = {
    leads: leads.length,
    leads_called: leadsCalled,
    leads_talked: leadsTalked,
    rentmi_placed: leads.filter((l) => isPlaced(colName.get(l.columnId) ?? "")).length,
    tenants: leads.filter((l) => isTenant(colName.get(l.columnId) ?? "")).length,
    calls_total: calls.length,
    calls_out: calls.filter((c) => c.direction === "out").length,
    calls_success: successCalls.length,
    talk_seconds: talkSeconds,
    avg_talk_seconds: talked.length ? Math.round(talked.reduce((s, c) => s + c.duration, 0) / talked.length) : 0,
    operators: operators.length,
    last_call_ms: calls.length ? calls[calls.length - 1].startedAt.getTime() : null,
  };

  const funnel = columns.map((c, i) => ({ stage: c.name, step: i + 1, n: leads.filter((l) => l.columnId === c.id).length }));

  const byDay = <T>(rows: T[], key: (r: T) => string, agg: (rows: T[]) => object) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const k = key(r);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, rs]) => ({ day: k, ...agg(rs) }));
  };
  const leads_by_day = byDay(leads, (l) => dayOf(l.createdAt), (rs) => ({ n: rs.length }));
  const calls_by_day = byDay(calls, (c) => dayOf(c.startedAt), (rs) => ({
    n: rs.length,
    ok: rs.filter((c) => c.status === "success").length,
    outgoing: rs.filter((c) => c.direction === "out").length,
    talk_seconds: rs.reduce((s, c) => s + c.duration, 0),
  }));

  const statusMap = new Map<string, { status: string; direction: string; n: number; talk_seconds: number }>();
  for (const c of calls) {
    const k = `${c.status}|${c.direction}`;
    const row = statusMap.get(k) ?? { status: c.status, direction: c.direction, n: 0, talk_seconds: 0 };
    row.n++;
    row.talk_seconds += c.duration;
    statusMap.set(k, row);
  }
  const calls_by_status = [...statusMap.values()].sort((a, b) => b.n - a.n);

  const hours = new Map<number, { hour: number; n: number; ok: number }>();
  for (const c of calls) {
    const h = hourOf(c.startedAt);
    const row = hours.get(h) ?? { hour: h, n: 0, ok: 0 };
    row.n++;
    if (c.status === "success") row.ok++;
    hours.set(h, row);
  }
  const calls_by_hour = [...hours.values()].sort((a, b) => a.hour - b.hour);

  const by_operator = operators.map((o) => {
    const oc = calls.filter((c) => c.operator === o.name);
    return {
      operator: o.name,
      leads: leads.filter((l) => l.operator === o.name).length,
      calls: oc.length,
      success: oc.filter((c) => c.status === "success").length,
      talk_seconds: oc.reduce((s, c) => s + c.duration, 0),
      softphone: o.softphone,
      last_sync_ms: o.lastSyncAt?.getTime() ?? null,
    };
  });

  const leadRows = leads.map((l) => {
    const lc = leadCalls(l);
    return {
      id: l.id,
      owner: l.ownerName,
      house: l.houseName,
      stage: colName.get(l.columnId) ?? "",
      operator: l.operator,
      result: l.callResult,
      olx_url: l.olxUrl,
      calls: lc.length,
      last_call_ms: lc.length ? Math.max(...lc.map((c) => c.startedAt.getTime())) : null,
      created_ms: l.createdAt.getTime(),
    };
  });

  res.json({ generated_at: new Date().toISOString(), summary: [summary], funnel, leads_by_day, calls_by_day, calls_by_status, calls_by_hour, by_operator, leads: leadRows });
});
