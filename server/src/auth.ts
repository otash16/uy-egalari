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
const page = (error = "", login = "") => `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Uy egalari — kirish</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 20px;background:radial-gradient(900px 480px at 18% 8%,#eef3fb 0%,transparent 60%),linear-gradient(160deg,#f7f9fc 0%,#eef1f6 100%);font:14px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#334155;-webkit-font-smoothing:antialiased}
.card{display:grid;grid-template-columns:1fr;width:100%;max-width:860px;overflow:hidden;border-radius:16px;border:1px solid #e2e8f0;background:#fff;box-shadow:0 18px 50px -18px rgba(15,42,50,.22),0 2px 8px rgba(15,42,50,.04)}
.brand{display:none;flex-direction:column;align-items:center;justify-content:center;gap:18px;border-right:1px solid #e2e8f0;padding:48px 40px;text-align:center;background:linear-gradient(165deg,#fbfcfe 0%,#eef3fb 100%)}
.logo{width:76px;height:76px;border-radius:22px;background:#0284c7;color:#fff;display:grid;place-items:center;box-shadow:0 10px 28px rgba(2,132,199,.32)}.logo.sm{width:52px;height:52px;border-radius:15px;margin:0 auto 22px}
.brand h1{margin:0;font-size:28px;font-weight:800;color:#0284c7;line-height:1.2}.brand p{margin:0;max-width:270px;color:#64748b;font-size:14px;line-height:1.6}
form{display:flex;flex-direction:column;justify-content:center;padding:32px 28px}
@media(min-width:768px){.card{grid-template-columns:1fr 1fr}.brand{display:flex}form{padding:48px 40px}.logo.sm{display:none}}
h2{margin:0;font-size:22px;font-weight:800;color:#0f172a}.sub{margin:6px 0 0;color:#64748b}
label{display:block;margin:20px 0 6px;font-size:13px;font-weight:500;color:#334155}
.in{position:relative}.in svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#8a93a6;pointer-events:none}
input{width:100%;font:inherit;padding:12px 16px 12px 42px;border:1px solid #e2e8f0;border-radius:10px;background:#eaeffb;color:#0f172a;outline:none;transition:border-color .15s,box-shadow .15s,background .15s}input::placeholder{color:#8a93a6}input:focus{border-color:#0284c7;box-shadow:0 0 0 3px rgba(2,132,199,.22);background:#fff}
.err{margin-top:20px;display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:10px;border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;font-size:14px}
button{margin-top:24px;font:inherit;font-weight:600;font-size:15px;height:46px;border:0;border-radius:10px;background:#0284c7;color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(2,132,199,.24);display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:background .15s}button:hover{background:#0369a1}
.foot{margin-top:22px;font-size:12px;color:#94a3b8;text-align:center}</style></head>
<body><div class="card">
<div class="brand"><div class="logo"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/></svg></div>
<h1>Uy egalari</h1><p>Call-center doskasi: OLX e'lonlarini Rentmi'ga ko'chirish va boshliqlar uchun voronka.</p></div>
<form method="post" action="/login"><div class="logo sm"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/></svg></div>
<h2>Tizimga kirish</h2><p class="sub">Hisobingizga kirish uchun login va parolingizni kiriting</p>
${error ? `<div class="err" role="alert"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/></svg><span>${esc(error)}</span></div>` : ""}
<label for="login">Login</label><div class="in"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg><input id="login" type="text" name="login" placeholder="Loginingiz" value="${esc(login)}" autofocus autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
<label for="password">Parol</label><div class="in"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><input id="password" type="password" name="password" placeholder="••••••••" autocomplete="current-password" required></div>
<input type="hidden" name="next" id="next"><button type="submit"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 16l4-4-4-4"/><path d="M13 12H3"/></svg>Kirish</button>
<div class="foot">Uy egalari doskasi · Rentmi call-center</div></form></div>
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
