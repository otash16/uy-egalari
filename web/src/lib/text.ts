import type { Lead } from "../types";

export const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

export function phoneKey(s: unknown) {
  let d = digits(s);
  if (d.length > 9 && d.startsWith("998")) d = d.slice(3);
  return d;
}

/** Havolalarni solishtirish uchun: protokol, www, query va oxirgi "/" olib tashlanadi. */
export const normUrl = (u: unknown) =>
  String(u ?? "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[?#]/)[0].replace(/\/+$/, "");

export const safeHref = (u: unknown) => {
  const t = String(u ?? "").trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : "https://" + t;
};

export function fmtPhone(s: unknown) {
  const d = digits(s);
  if (d.length === 12 && d.startsWith("998")) return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  if (d.length === 9) return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
  return String(s ?? "");
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** OLX havolasidagi slugdan uy nomi: ".../arenda-kvartira-ID4uKld.html" → "Arenda kvartira". */
export function olxTitle(url: unknown) {
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

/** Qidiruv: ism, uy nomi, izoh, OLX/Rentmi havolasi va telefon raqami (formatdan qat'i nazar). */
export function matches(l: Lead, q: string) {
  if (!q) return true;
  const ql = q.toLowerCase();
  if ([l.ownerName, l.houseName, l.note, l.olxUrl, l.rentmeUrl].some((h) => h.toLowerCase().includes(ql))) return true;
  if (/[./]/.test(q)) {
    const nq = normUrl(q);
    if (nq && [l.olxUrl, l.rentmeUrl].some((u) => normUrl(u).includes(nq))) return true;
  }
  const dq = digits(q);
  if (dq.length >= 3 && dq.length >= ql.replace(/[\s+()-]/g, "").length) {
    if (digits(l.phone).includes(dq) || phoneKey(l.phone).includes(phoneKey(dq))) return true;
  }
  return false;
}

export function isPhoneQuery(q: string) {
  const dq = digits(q);
  return dq.length >= 3 && dq.length >= q.replace(/[\s+()-]/g, "").length;
}
