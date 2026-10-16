import { Router } from "express";
import { prisma, topOrder } from "../db.js";
import { HttpError, olxTitle, phoneKey } from "../lib/text.js";

export const leadsRouter = Router();

const TEXT_FIELDS = ["ownerName", "phone", "houseName", "olxUrl", "rentmeUrl", "note", "nextCall"] as const;
type TextField = (typeof TEXT_FIELDS)[number];
export const CALL_RESULTS = ["", "no_answer", "talked", "declined"];

function pickLead(body: any) {
  const data: Partial<Record<TextField, string>> & { phoneKey?: string; callResult?: string } = {};
  for (const f of TEXT_FIELDS) if (typeof body?.[f] === "string") data[f] = body[f].trim().slice(0, f === "note" ? 4000 : 1000);
  if (data.nextCall && !/^\d{4}-\d{2}-\d{2}$/.test(data.nextCall)) throw new HttpError(400, "Sana noto'g'ri");
  if (data.phone !== undefined) data.phoneKey = phoneKey(data.phone);
  if (typeof body?.callResult === "string") {
    if (!CALL_RESULTS.includes(body.callResult)) throw new HttpError(400, "Natija noto'g'ri");
    data.callResult = body.callResult;
  }
  return data;
}

async function assertColumn(id: unknown) {
  if (typeof id !== "string" || !(await prisma.column.findUnique({ where: { id }, select: { id: true } })))
    throw new HttpError(400, "Bunday ustun yo'q");
  return id;
}

leadsRouter.post("/", async (req, res) => {
  const data = pickLead(req.body);
  if (!data.ownerName && !data.phone && !data.olxUrl) throw new HttpError(400, "Kamida ism, raqam yoki OLX havolasini kiriting");
  const columnId = await assertColumn(req.body?.columnId);
  if (!data.houseName && data.olxUrl) data.houseName = olxTitle(data.olxUrl);
  const lead = await prisma.lead.create({ data: { ...data, columnId, order: await topOrder(columnId) } });
  res.status(201).json(lead);
});

leadsRouter.patch("/:id", async (req, res) => {
  const current = await prisma.lead.findUnique({ where: { id: req.params.id } });
  if (!current) throw new HttpError(404, "Karta topilmadi");
  const data: Record<string, unknown> = pickLead(req.body);
  if (req.body?.columnId !== undefined && req.body.columnId !== current.columnId) {
    data.columnId = await assertColumn(req.body.columnId);
    data.order = await topOrder(req.body.columnId);
  }
  res.json(await prisma.lead.update({ where: { id: current.id }, data }));
});

leadsRouter.delete("/:id", async (req, res) => {
  await prisma.lead.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/** Kartani ustunga suradi: beforeId berilsa o'sha kartadan oldinga, aks holda oxiriga. */
leadsRouter.post("/:id/move", async (req, res) => {
  const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
  if (!lead) throw new HttpError(404, "Karta topilmadi");
  const columnId = await assertColumn(req.body?.columnId);
  const beforeId: string | null = typeof req.body?.beforeId === "string" ? req.body.beforeId : null;

  let order: number;
  const before = beforeId ? await prisma.lead.findFirst({ where: { id: beforeId, columnId } }) : null;
  if (before) {
    const prev = await prisma.lead.findFirst({
      where: { columnId, order: { lt: before.order }, id: { not: lead.id } },
      orderBy: { order: "desc" },
    });
    order = prev ? (prev.order + before.order) / 2 : before.order - 1000;
  } else {
    const last = await prisma.lead.findFirst({ where: { columnId, id: { not: lead.id } }, orderBy: { order: "desc" } });
    order = (last?.order ?? 0) + 1000;
  }
  res.json(await prisma.lead.update({ where: { id: lead.id }, data: { columnId, order } }));
});
