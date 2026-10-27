/**
 * Instagram lidlari — Google Forms javoblari tushadigan Google Sheets jadvalidan o'qiladi
 * (havola bilan ochiq jadval, CSV eksport). Dashboard uchun: nechta ariza, nechtasi telefon raqam qoldirgan.
 * Natija 5 daqiqa xotirada keshlanadi — har dashboard yangilanishida Google'ga bormaymiz.
 */
const SHEET_ID = process.env.INSTAGRAM_SHEET_ID || "12qx2mr1kOgkfi14i15K3aPKX7pk6gUtHs9vCXONNPlk";
const TTL_MS = 5 * 60_000;

export type InstagramStats = {
  /** Barcha arizalar (bo'sh yuborilganlar ham) */
  total: number;
  /** Telefon raqam qoldirganlar (kamida 7 raqam) */
  with_phone: number;
  /** Takrorlanmas raqamlar (bir odam ikki marta yuborgan bo'lsa bitta) */
  unique_phones: number;
  /** Oxirgi ariza vaqti, jadvaldagi ko'rinishida ("22.10.2026 11:47:36") */
  last_at: string | null;
  fetched_at: string;
  /** Jadvalni o'qib bo'lmadi — eski (keshdagi) raqamlar yoki nol bilan qaytadi */
  error?: string;
};

let cache: { at: number; data: InstagramStats } | null = null;

/** Oddiy CSV: qo'shtirnoqli maydonlar ichida vergul va yangi qator bo'lishi mumkin. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** "+998 90 116 01 07", "95.969.15.13", "909202800" → oxirgi 9 raqam; 7 dan kam raqam — raqam emas. */
const phoneKey = (s: string) => {
  const d = s.replace(/\D/g, "");
  if (d.length < 7) return "";
  return d.length > 9 ? d.slice(-9) : d;
};

export async function instagramStats(): Promise<InstagramStats> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Google Sheets javobi ${res.status}`);
    const all = parseCsv(await res.text());
    const header = all[0] ?? [];
    const rows = all.slice(1).filter((r) => r.some((c) => c.trim()));
    // Telefon ustuni sarlavhasidan topiladi; topilmasa — oxirgi ustun
    let phoneIdx = header.findIndex((h) => /telefon|raqam|phone|номер/i.test(h));
    if (phoneIdx < 0) phoneIdx = header.length - 1;
    const phones = rows.map((r) => phoneKey(r[phoneIdx] ?? "")).filter(Boolean);
    const data: InstagramStats = {
      total: rows.length,
      with_phone: phones.length,
      unique_phones: new Set(phones).size,
      last_at: rows.length ? rows[rows.length - 1][0]?.trim() || null : null,
      fetched_at: new Date().toISOString(),
    };
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    const msg = (e as Error).name === "TimeoutError" ? "Google javob bermadi (10 s)" : (e as Error).message;
    const base = cache?.data ?? { total: 0, with_phone: 0, unique_phones: 0, last_at: null, fetched_at: new Date().toISOString() };
    return { ...base, error: msg };
  }
}
