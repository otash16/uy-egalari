import { Router } from "express";
import { prisma, topOrder } from "../db.js";
import { HttpError } from "../lib/text.js";

export const columnsRouter = Router();

function pickColumn(body: any) {
  const data: { name?: string; color?: number } = {};
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) throw new HttpError(400, "Ustun nomini yozing");
    data.name = name.slice(0, 80);
  }
  if (Number.isInteger(body?.color)) data.color = Math.abs(body.color) % 6;
  return data;
}

columnsRouter.post("/", async (req, res) => {
  const data = pickColumn(req.body);
  if (!data.name) throw new HttpError(400, "Ustun nomini yozing");
  const last = await prisma.column.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  const column = await prisma.column.create({ data: { name: data.name, color: data.color ?? 0, order: (last?.order ?? 0) + 1000 } });
  res.status(201).json(column);
});

columnsRouter.patch("/:id", async (req, res) => {
  const column = await prisma.column.update({ where: { id: req.params.id }, data: pickColumn(req.body) });
  res.json(column);
});

/** Ustunni chapga (-1) yoki o'ngga (+1) suradi — qo'shnisi bilan o'rin almashadi. */
columnsRouter.post("/:id/move", async (req, res) => {
  const dir = req.body?.dir === -1 ? -1 : 1;
  const cols = await prisma.column.findMany({ orderBy: { order: "asc" } });
  const i = cols.findIndex((c) => c.id === req.params.id);
  if (i < 0) throw new HttpError(404, "Ustun topilmadi");
  const j = i + dir;
  if (j < 0 || j >= cols.length) return res.json({ ok: true });
  await prisma.$transaction([
    prisma.column.update({ where: { id: cols[i].id }, data: { order: cols[j].order } }),
    prisma.column.update({ where: { id: cols[j].id }, data: { order: cols[i].order } }),
  ]);
  res.json({ ok: true });
});

/** Ustunni o'chiradi; ichidagi kartalar birinchi qolgan ustunga o'tadi. */
columnsRouter.delete("/:id", async (req, res) => {
  const id = req.params.id;
  const target = await prisma.column.findFirst({ where: { id: { not: id } }, orderBy: { order: "asc" } });
  const leads = await prisma.lead.findMany({ where: { columnId: id }, orderBy: { order: "asc" }, select: { id: true } });
  if (leads.length && !target) throw new HttpError(400, "Bu oxirgi ustun va ichida kartalar bor. Avval boshqa ustun yarating.");
  let order = target ? await topOrder(target.id) : 0;
  await prisma.$transaction([
    ...leads.reverse().map((l) => prisma.lead.update({ where: { id: l.id }, data: { columnId: target!.id, order: (order -= 1000) } })),
    prisma.column.delete({ where: { id } }),
  ]);
  res.json({ ok: true, movedTo: target?.name ?? null, moved: leads.length });
});
