import { Router } from "express";
import { prisma } from "../db.js";
import { HttpError } from "../lib/text.js";
import { checkPassword, hashPassword, newToken, publicUser, ROLES, type Role } from "../auth.js";
import { ensureOperator } from "../sync.js";

/** Foydalanuvchilarni boshqarish — faqat dasturchi (index.ts da requireRole("dev")). */
export const usersRouter = Router();

function pickLogin(v: unknown) {
  const login = String(v ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,32}$/.test(login)) throw new HttpError(400, "Login 2–32 belgi: lotin harf, raqam, nuqta, chiziqcha");
  return login;
}
function pickRole(v: unknown): Role {
  if (!ROLES.includes(v as Role)) throw new HttpError(400, "Rol noto'g'ri");
  return v as Role;
}
async function pickOperator(v: unknown) {
  const name = String(v ?? "").trim().slice(0, 40);
  if (name) await ensureOperator(name);
  return name;
}

async function assertNotLastDev(id: string, nextRole?: string, nextActive?: boolean) {
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw new HttpError(404, "Foydalanuvchi topilmadi");
  const losesDev = u.role === "dev" && u.active && ((nextRole !== undefined && nextRole !== "dev") || nextActive === false);
  if (losesDev && (await prisma.user.count({ where: { role: "dev", active: true } })) <= 1) throw new HttpError(400, "Oxirgi dasturchini o'zgartirib bo'lmaydi");
  return u;
}

usersRouter.get("/", async (_req, res) => {
  const list = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  res.json(list.map(publicUser));
});

usersRouter.post("/", async (req, res) => {
  const login = pickLogin(req.body?.login);
  const name = String(req.body?.name ?? "").trim().slice(0, 60) || login;
  const role = pickRole(req.body?.role);
  const operator = await pickOperator(req.body?.operator);
  const password = checkPassword(req.body?.password);
  if (await prisma.user.findUnique({ where: { login } })) throw new HttpError(400, "Bunday login bor");
  const u = await prisma.user.create({ data: { login, name, role, operator, passwordHash: hashPassword(password), agentToken: operator ? newToken() : null } });
  res.status(201).json(publicUser(u));
});

usersRouter.patch("/:id", async (req, res) => {
  const b = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (b.role !== undefined) data.role = pickRole(b.role);
  if (b.active !== undefined) data.active = !!b.active;
  const u = await assertNotLastDev(req.params.id, data.role as string | undefined, data.active as boolean | undefined);
  if (u.id === req.user!.id && (data.active === false || (data.role && data.role !== "dev"))) throw new HttpError(400, "O'zingizni o'chira yoki rolingizni pasaytira olmaysiz");
  if (b.login !== undefined) {
    data.login = pickLogin(b.login);
    const other = await prisma.user.findUnique({ where: { login: data.login as string } });
    if (other && other.id !== u.id) throw new HttpError(400, "Bunday login bor");
  }
  if (typeof b.name === "string") data.name = b.name.trim().slice(0, 60) || u.login;
  if (b.operator !== undefined) {
    data.operator = await pickOperator(b.operator);
    if (data.operator && !u.agentToken) data.agentToken = newToken();
  }
  if (b.password !== undefined && b.password !== "") {
    data.passwordHash = hashPassword(checkPassword(b.password));
    await prisma.session.deleteMany({ where: { userId: u.id } });
  }
  if (data.active === false) await prisma.session.deleteMany({ where: { userId: u.id } });
  res.json(publicUser(await prisma.user.update({ where: { id: u.id }, data })));
});

/** Agent tokenini ko'rish (faqat dasturchi, sherikning config.json'i uchun). */
usersRouter.get("/:id/token", async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!u) throw new HttpError(404, "Foydalanuvchi topilmadi");
  if (!u.operator) throw new HttpError(400, "Operator bog'lanmagan — agent tokeni kerak emas");
  res.json({ token: u.agentToken });
});
/** Yangi token (eski darhol ishlamay qoladi). */
usersRouter.post("/:id/token", async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!u) throw new HttpError(404, "Foydalanuvchi topilmadi");
  if (!u.operator) throw new HttpError(400, "Operator bog'lanmagan");
  const token = newToken();
  await prisma.user.update({ where: { id: u.id }, data: { agentToken: token } });
  res.json({ token });
});

usersRouter.delete("/:id", async (req, res) => {
  const u = await assertNotLastDev(req.params.id, undefined, false);
  if (u.id === req.user!.id) throw new HttpError(400, "O'zingizni o'chira olmaysiz");
  await prisma.user.delete({ where: { id: u.id } });
  res.json({ ok: true });
});
