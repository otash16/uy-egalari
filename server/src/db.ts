import { PrismaClient } from "@prisma/client";

// Standart: server/prisma/dev.db (Prisma nisbiy yo'lni schema.prisma joyidan hisoblaydi). Docker: DATABASE_URL=file:/data/dev.db
process.env.DATABASE_URL ??= "file:./dev.db";

export const prisma = new PrismaClient();

const DEFAULT_COLUMNS = ["Yangi", "Qo'ng'iroq qilindi", "Qayta qo'ng'iroq", "Rozi bo'ldi", "Rentmi'ga joylandi", "Rad etdi"];

/** Baza bo'sh bo'lsa standart ustunlarni yaratadi. */
export async function ensureDefaultColumns() {
  const count = await prisma.column.count();
  if (count > 0) return;
  await prisma.column.createMany({
    data: DEFAULT_COLUMNS.map((name, i) => ({ name, color: i, order: (i + 1) * 1000 })),
  });
}

/** Ustunning eng tepasiga qo'yish uchun order qiymati. */
export async function topOrder(columnId: string) {
  const first = await prisma.lead.findFirst({ where: { columnId }, orderBy: { order: "asc" }, select: { order: true } });
  return (first?.order ?? 0) - 1000;
}

export async function firstColumnId() {
  const col = await prisma.column.findFirst({ orderBy: { order: "asc" }, select: { id: true } });
  return col?.id ?? null;
}
