import crypto from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";

/**
 * Sayt ochiq internetda bo'lgani uchun bitta umumiy parol: BOARD_PASSWORD env.
 * Brauzer — /login sahifasidan cookie oladi; agentlar — "Authorization: Bearer <parol>" sarlavhasi.
 * BOARD_PASSWORD berilmasa (ofis tarmog'ida lokal) himoya o'chiq.
 */
const PASSWORD = process.env.BOARD_PASSWORD ?? "";
const COOKIE = "uy_auth";
const COOKIE_DAYS = 180;
const cookieToken = PASSWORD ? crypto.createHash("sha256").update("uy-egalari:" + PASSWORD).digest("hex") : "";

const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function cookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function isAuthed(req: Request) {
  if (!PASSWORD) return true;
  const h = req.headers.authorization ?? "";
  if (h.startsWith("Bearer ") && safeEqual(h.slice(7), PASSWORD)) return true;
  const c = cookies(req)[COOKIE] ?? "";
  return !!c && safeEqual(c, cookieToken);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (isAuthed(req)) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Kirish kerak: sahifani yangilab parolni kiriting" });
  res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
}

const page = (error = "") => `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Uy egalari doskasi — kirish</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f2f2;font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f0f0f}
form{background:#fff;border-radius:20px;padding:28px;width:min(92vw,360px);display:grid;gap:12px}h1{margin:0 0 4px;font-size:20px}p{margin:0;color:#6a6a6a;font-size:13px}
input{font:inherit;padding:12px 14px;border:1px solid #d2d2d2;border-radius:12px}input:focus{outline:2px solid #2f6bff;border-color:#2f6bff}
button{font:inherit;font-weight:600;padding:13px;border:0;border-radius:999px;background:#2f6bff;color:#fff;cursor:pointer}.err{color:#cf0f0f;font-size:13px}</style></head>
<body><form method="post" action="/login"><h1>Uy egalari doskasi</h1><p>Kirish uchun umumiy parolni kiriting.</p>
<input type="password" name="password" placeholder="Parol" autofocus autocomplete="current-password" required>
<input type="hidden" name="next" id="next">${error ? `<div class="err">${error}</div>` : ""}<button type="submit">Kirish</button></form>
<script>document.getElementById("next").value=new URLSearchParams(location.search).get("next")||"/"</script></body></html>`;

export const loginRouter = Router();
loginRouter.get("/login", (req, res) => {
  if (isAuthed(req)) return res.redirect("/");
  res.type("html").send(page());
});
loginRouter.post("/login", (req, res) => {
  const given = String(req.body?.password ?? "");
  if (!PASSWORD || !safeEqual(given, PASSWORD)) return res.status(401).type("html").send(page("Parol noto'g'ri"));
  const secure = req.headers["x-forwarded-proto"] === "https" || req.secure;
  res.setHeader("Set-Cookie", `${COOKIE}=${cookieToken}; Path=/; Max-Age=${COOKIE_DAYS * 86400}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`);
  const next = String(req.body?.next ?? "/");
  res.redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
});
loginRouter.get("/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  res.redirect("/login");
});
