import express, { type ErrorRequestHandler } from "express";
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
import { watchLinphone } from "./linphone.js";

const PORT = Number(process.env.PORT ?? 4000);
const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.text({ type: ["text/csv", "text/plain"], limit: "10mb" }));

app.get("/api/board", async (_req, res) => {
  const [columns, leads] = await Promise.all([
    prisma.column.findMany({ orderBy: { order: "asc" } }),
    prisma.lead.findMany({ orderBy: { order: "asc" } }),
  ]);
  res.json({ columns, leads });
});
app.get("/api/events", eventsHandler);
app.use("/api/columns", columnsRouter);
app.use("/api/leads", leadsRouter);
app.use("/api", importExportRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Bunday API yo'q" }));

// Build qilingan frontendni shu serverning o'zi beradi (yarn start).
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")
    return res.status(404).json({ error: "Topilmadi — sahifani yangilang" });
  console.error(err);
  res.status(500).json({ error: "Serverda xato: " + (err?.message ?? "noma'lum") });
};
app.use(onError);

await ensureDefaultColumns();
// Linphone'ga yangi kontakt qo'shilsa avtomatik doskaga tushadi va ochiq sahifa yangilanadi
watchLinphone((r) => {
  console.log(`Linphone: ${r.added} ta yangi kontakt — ${r.names.join(", ")}`);
  broadcast("linphone", r);
});
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Uy egalari doskasi: http://localhost:${PORT}`);
});
