import type { Operator } from "../types";

/** Operator → rang indeksi (--c0..--c5). Komponentlar chuqur bo'lgani uchun oddiy registr. */
let colors = new Map<string, number>();
export function setOperators(list: Operator[]) {
  colors = new Map(list.map((o) => [o.name, o.color]));
}
export const opColor = (name: string) => `var(--c${(colors.get(name) ?? 0) % 6})`;

/** Agent oxirgi 2 daqiqada xabar bergan bo'lsa — ulangan. */
export const isOnline = (o: Operator) => !!o.lastSyncAt && Date.now() - new Date(o.lastSyncAt).getTime() < 2 * 60 * 1000;
