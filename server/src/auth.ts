import crypto from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { User } from "@prisma/client";
import { prisma } from "./db.js";
import { HttpError } from "./lib/text.js";

/**
 * Har bir foydalanuvchi o'z login/paroli bilan kiradi (User jadvali). Ruxsatlar — bayroqlar:
 *   isAdmin (dasturchi: hammasi + foydalanuvchilar), canBoard (kanban), canDashboard (boshliqlar dashboardi).
 * Brauzer — /login sahifasidan sessiya cookie'si (uy_sid) oladi.
 * Agentlar — "Authorization: Bearer <agentToken>" (User.agentToken, faqat operator bog'langan foydalanuvchi).
 */
export type Section = "board" | "dashboard";
const SECTION_LABEL: Record<Section, string> = { board: "Kanban", dashboard: "Dashboard" };
export const hasAccess = (u: User, s: Section) => u.isAdmin || (s === "board" ? u.canBoard : u.canDashboard);
/** Login'dan keyin qaysi sahifa: kanban, bo'lmasa dashboard, hech biri bo'lmasa null. */
export const homeFor = (u: User) => (hasAccess(u, "board") ? "/" : hasAccess(u, "dashboard") ? "/dashboard" : null);

const COOKIE = "uy_sid";
const SESSION_DAYS = 180;

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
    /** So'rov agent tokeni bilan kelgan (sessiya emas) */
    viaToken?: boolean;
  }
}

// ---------- parol ----------
export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}
export function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const got = crypto.scryptSync(password, salt, 32);
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
export function checkPassword(p: unknown) {
  const s = String(p ?? "");
  if (s.length < 6) throw new HttpError(400, "Parol kamida 6 ta belgi bo'lsin");
  if (s.length > 100) throw new HttpError(400, "Parol juda uzun");
  return s;
}
export const newToken = () => crypto.randomBytes(24).toString("base64url");

// ---------- sessiya ----------
function cookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function userFromRequest(req: Request): Promise<User | null> {
  const h = req.headers.authorization ?? "";
  if (h.startsWith("Bearer ")) {
    const u = await prisma.user.findUnique({ where: { agentToken: h.slice(7).trim() || "-" } });
    if (u && u.active) {
      req.viaToken = true;
      return u;
    }
    return null;
  }
  const sid = cookies(req)[COOKIE];
  if (!sid) return null;
  const s = await prisma.session.findUnique({ where: { id: sid }, include: { user: true } });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  return s.user;
}

async function createSession(res: Response, req: Request, userId: string) {
  const id = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({ data: { id, userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000) } });
  const secure = req.headers["x-forwarded-proto"] === "https" || req.secure;
  res.setHeader("Set-Cookie", `${COOKIE}=${id}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`);
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = await userFromRequest(req);
  if (user) {
    req.user = user;
    return next();
  }
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Kirish kerak: sahifani yangilab login va parolni kiriting" });
  res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
}

/** Faqat dasturchi. */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) throw new HttpError(401, "Kirish kerak");
  if (!req.user.isAdmin) throw new HttpError(403, "Bu amal faqat dasturchi uchun");
  next();
};
/** Bo'limga (kanban / dashboard) ruxsati borlar. */
export const requireAccess = (s: Section) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) throw new HttpError(401, "Kirish kerak");
  if (!hasAccess(req.user, s)) throw new HttpError(403, `${SECTION_LABEL[s]} bo'limiga ruxsat yo'q`);
  next();
};

/** Mijozga yuboriladigan foydalanuvchi (parolsiz). */
export function publicUser(u: User) {
  return {
    id: u.id, login: u.login, name: u.name, isAdmin: u.isAdmin, canBoard: u.canBoard, canDashboard: u.canDashboard,
    operator: u.operator, active: u.active, hasToken: !!u.agentToken, createdAt: u.createdAt,
  };
}

// ---------- birinchi foydalanuvchi ----------
/**
 * Bazada hech kim bo'lmasa dasturchi hisobini yaratadi: login INIT_ADMIN_LOGIN (standart "otajon"),
 * parol INIT_ADMIN_PASSWORD yoki BOARD_PASSWORD (eski umumiy parol), ikkisi ham bo'lmasa tasodifiy va konsolga yoziladi.
 */
export async function ensureInitialUser() {
  if (await prisma.user.count()) return;
  const login = (process.env.INIT_ADMIN_LOGIN ?? "otajon").toLowerCase();
  let password = process.env.INIT_ADMIN_PASSWORD || process.env.BOARD_PASSWORD || "";
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(6).toString("base64url");
    generated = true;
  }
  // Operator: nomi login bilan bir xil bo'lgani (katta-kichik harfsiz), bo'lmasa lokal softphone'li birinchisi
  const ops = await prisma.operator.findMany({ orderBy: { createdAt: "asc" } });
  const op = ops.find((o) => o.name.toLowerCase() === login) ?? ops.find((o) => o.softphone === "linphone") ?? ops[0];
  await prisma.user.create({
    data: { login, name: op?.name ?? "Otajon", passwordHash: hashPassword(password), isAdmin: true, canBoard: true, canDashboard: true, operator: op?.name ?? "", agentToken: newToken() },
  });
  console.log(`Birinchi foydalanuvchi yaratildi: ${login} (dasturchi)` + (generated ? ` — parol: ${password}` : ""));
}

// ---------- login sahifasi ----------
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const page = (error = "", login = "") => `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Uy egalari doskasi — kirish</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f2f2;font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f0f0f}
form{background:#fff;border-radius:20px;padding:28px;width:min(92vw,360px);display:grid;gap:12px}h1{margin:0 0 4px;font-size:20px}p{margin:0;color:#6a6a6a;font-size:13px}
input{font:inherit;padding:12px 14px;border:1px solid #d2d2d2;border-radius:12px}input:focus{outline:2px solid #2f6bff;border-color:#2f6bff}
button{font:inherit;font-weight:600;padding:13px;border:0;border-radius:999px;background:#2f6bff;color:#fff;cursor:pointer}.err{color:#cf0f0f;font-size:13px}</style></head>
<body><form method="post" action="/login"><h1>Uy egalari doskasi</h1><p>Login va parolingizni kiriting.</p>
<input type="text" name="login" placeholder="Login" value="${esc(login)}" autofocus autocomplete="username" autocapitalize="none" spellcheck="false" required>
<input type="password" name="password" placeholder="Parol" autocomplete="current-password" required>
<input type="hidden" name="next" id="next">${error ? `<div class="err">${esc(error)}</div>` : ""}<button type="submit">Kirish</button></form>
<script>document.getElementById("next").value=new URLSearchParams(location.search).get("next")||"/"</script></body></html>`;

export const loginRouter = Router();
loginRouter.get("/login", async (req, res) => {
  if (await userFromRequest(req)) return res.redirect("/");
  res.type("html").send(page());
});
loginRouter.post("/login", async (req, res) => {
  const login = String(req.body?.login ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const u = login ? await prisma.user.findUnique({ where: { login } }) : null;
  if (!u || !u.active || !verifyPassword(password, u.passwordHash)) return res.status(401).type("html").send(page("Login yoki parol noto'g'ri", login));
  const home = homeFor(u);
  if (!home) return res.status(403).type("html").send(page("Sizga hech qanday bo'lim ochilmagan — dasturchiga murojaat qiling", login));
  await createSession(res, req, u.id);
  const next = String(req.body?.next ?? "");
  res.redirect(next.startsWith("/") && !next.startsWith("//") && next !== "/" ? next : home);
});
loginRouter.get("/logout", async (req, res) => {
  const sid = cookies(req)[COOKIE];
  if (sid) await prisma.session.deleteMany({ where: { id: sid } });
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  res.redirect("/login");
});

// ---------- /api/me ----------
export const meRouter = Router();
meRouter.get("/me", (req, res) => res.json(publicUser(req.user!)));
/** Parolni o'zgartirish: boshqa sessiyalar yopiladi, shu brauzer qoladi. */
meRouter.post("/me/password", async (req, res) => {
  const u = req.user!;
  if (!verifyPassword(String(req.body?.current ?? ""), u.passwordHash)) throw new HttpError(400, "Joriy parol noto'g'ri");
  const next = checkPassword(req.body?.next);
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: hashPassword(next) } });
  const sid = cookies(req)[COOKIE];
  await prisma.session.deleteMany({ where: { userId: u.id, id: { not: sid ?? "" } } });
  res.json({ ok: true });
});
