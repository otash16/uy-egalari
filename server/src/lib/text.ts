export const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** +998 90 123 45 67 → "901234567" (qidiruv va dublikat uchun). */
export function phoneKey(s: unknown): string {
  let d = digits(s);
  if (d.length > 9 && d.startsWith("998")) d = d.slice(3);
  return d;
}

/** OLX havolasidagi slugdan uy nomini yasaydi: ".../arenda-kvartira-ID4uKld.html" → "Arenda kvartira". */
export function olxTitle(url: unknown): string {
  const m = String(url ?? "").match(/olx\.uz\/d\/(?:[a-z]{2}\/)?obyavlenie\/([^?#/]+?)(?:-ID[0-9A-Za-z]+)?(?:\.html)?(?:[?#/]|$)/i);
  if (!m) return "";
  let t: string;
  try {
    t = decodeURIComponent(m[1]);
  } catch {
    t = m[1];
  }
  t = t.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Minimal CSV parser: qo'shtirnoq, vergul va qator ichidagi yangi qatorlarni qo'llaydi. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export const csvCell = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
