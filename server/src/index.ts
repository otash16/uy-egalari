import express, { type ErrorRequestHandler } from "express";
import compression from "compression";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import { ensureDefaultColumns, prisma } from "./db.js";
import { HttpError } from "./lib/text.js";
import { columnsRouter } from "./routes/columns.js";
import { importExportRouter } from "./routes/importExport.js";
import { leadsRouter } from "./routes/leads.js";
import { broadcast, eventsHandler } from "./events.js";
import { operatorsRouter } from "./routes/operators.js";
import { statsRouter } from "./routes/stats.js";
import { applySync } from "./sync.js";
import { localOperator, watchLocal } from "./local.js";
import { authMiddleware, ensureInitialUser, loginRouter, meRouter, requireAccess, requireAdmin } from "./auth.js";
import { usersRouter } from "./routes/users.js";

const PORT = Number(process.env.PORT ?? 4100);
// Ofis tarmog'idagi sherik ham ochishi uchun hamma interfeyslarda eshitadi. Faqat o'zim uchun: HOST=127.0.0.1
const HOST = process.env.HOST ?? "0.0.0.0";
const app = express();
// JS/CSS/JSON gzip bilan uzatiladi (259 KB bundle → ~80 KB). SSE oqimi (/api/events) siqilmaydi — aks holda hodisalar buferda qolib ketadi.
app.use(compression({ filter: (req, res) => req.path !== "/api/events" && compression.filter(req, res) }));

app.use(express.json({ limit: "1mb" }));
app.use(express.text({ type: ["text/csv", "text/plain"], limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));
// Nginx orqasida: x-forwarded-proto to'g'ri o'qilsin (cookie Secure uchun)
app.set("trust proxy", "loopback");
app.use(loginRouter);
app.use(authMiddleware);

app.use(["/api/board", "/api/calls", "/api/events", "/api/leads"], requireAccess("board"));
app.get("/api/board", async (_req, res) => {
  const [columns, leads, operators] = await Promise.all([
    prisma.column.findMany({ orderBy: { order: "asc" } }),
    prisma.lead.findMany({ orderBy: { order: "asc" } }),
    prisma.operator.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  res.json({ columns, leads, operators, localOperator });
});
app.get("/api/calls", async (_req, res) => {
  res.json(await prisma.call.findMany({ orderBy: { startedAt: "desc" }, take: 5000 }));
});
app.get("/api/events", eventsHandler);
/** Agentlardan (sherikning kompyuteridan) kontakt va qo'ng'iroqlar. Operator nomi tokenga bog'langan foydalanuvchidan olinadi. */
app.post("/api/sync", async (req, res) => {
  const u = req.user!;
  if (!u.operator) throw new HttpError(403, "Bu hisobga operator bog'lanmagan — sync qila olmaydi");
  const r = await applySync({ ...(req.body ?? {}), operator: u.operator });
  if (r.added || r.calls || r.warnings.length) broadcast("sync", r);
  res.json(r);
});
app.use("/api", meRouter);
app.use("/api/users", requireAdmin, usersRouter);
app.use("/api/operators", operatorsRouter);
app.use("/api/columns", requireAdmin, columnsRouter);
app.use("/api/leads", leadsRouter);
app.use(["/api/sync/local", "/api/export.csv", "/api/import/csv"], requireAdmin);
app.use("/api", importExportRouter);
app.use("/api/stats", requireAccess("dashboard"));
app.use("/api", statsRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Bunday API yo'q" }));

// Build qilingan frontendni shu serverning o'zi beradi (yarn start).
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
if (fs.existsSync(dist)) {
  // /assets/* nomida hash bor — bir yil keshlanadi (brauzer qayta so'ramaydi). index.html esa har safar tekshiriladi.
  app.use("/assets", express.static(path.join(dist, "assets"), { maxAge: "1y", immutable: true, index: false }));
  app.use(express.static(dist, { index: false }));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html"), { headers: { "Cache-Control": "no-cache" } }));
}

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError || (typeof err?.status === "number" && err.message)) return res.status(err.status).json({ error: err.message });
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
    return res.status(404).json({ error: "Topilmadi — sahifani yangilang" });
  console.error(err);
  res.status(500).json({ error: "Serverda xato: " + (err?.message ?? "noma'lum") });
};
app.use(onError);

await ensureDefaultColumns();
await ensureInitialUser();
// Shu kompyuterdagi softphone'ga yangi kontakt/qo'ng'iroq tushsa doskaga yoziladi va ochiq sahifalar yangilanadi
watchLocal((r) => {
  if (r.added) console.log(`${r.operator}: ${r.added} ta yangi kontakt — ${r.names.join(", ")}`);
  if (r.calls) console.log(`${r.operator}: ${r.calls} ta yangi qo'ng'iroq`);
  broadcast("sync", r);
});
app.listen(PORT, HOST, () => {
  console.log(`Uy egalari doskasi: http://localhost:${PORT}${HOST === "0.0.0.0" ? "  (tarmoqda ham ochiq)" : ""}`);
});
