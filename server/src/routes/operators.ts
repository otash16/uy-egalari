import { Router } from "express";
import { prisma } from "../db.js";
import { HttpError } from "../lib/text.js";
import { ensureOperator } from "../sync.js";
import { requireRole } from "../auth.js";

export const operatorsRouter = Router();

operatorsRouter.get("/", async (_req, res) => {
  res.json(await prisma.operator.findMany({ orderBy: { createdAt: "asc" } }));
});

/** Yangi operator (brauzerda "Siz kimsiz?" oynasidan). */
operatorsRouter.post("/", requireRole("dev", "pm"), async (req, res) => {
  const op = await ensureOperator(req.body?.name);
  res.status(201).json(op);
});

operatorsRouter.patch("/:name", requireRole("dev", "pm"), async (req, res) => {
  const data: { color?: number } = {};
  if (Number.isInteger(req.body?.color)) data.color = Math.abs(req.body.color) % 6;
  const op = await prisma.operator.findUnique({ where: { name: String(req.params.name) } });
  if (!op) throw new HttpError(404, "Operator topilmadi");
  res.json(await prisma.operator.update({ where: { name: op.name }, data }));
});
