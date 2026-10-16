import type { Call } from "../types";
import { todayStr } from "./text";

/** Qo'ng'iroq natijasi — yo'nalishga qarab tushunarli so'z bilan. */
export function callLabel(c: Call): string {
  switch (c.status) {
    case "success":
      return "Gaplashildi";
    case "aborted":
    case "early_aborted":
      return c.direction === "out" ? "Javob bo'lmadi" : "Uzildi";
    case "missed":
      return "O'tkazib yuborildi";
    case "declined":
      return c.direction === "out" ? "Rad etdi" : "Rad etildi";
    case "accepted_elsewhere":
      return "Boshqa operator oldi";
    case "declined_elsewhere":
      return "Boshqa joyda rad etildi";
    default:
      return "Noma'lum";
  }
}

export const isTalked = (c: Call) => c.status === "success";

/** 65 → "1:05" */
export function fmtDuration(sec: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Bugungi qo'ng'iroq uchun faqat vaqt, boshqalari uchun sana va vaqt. */
export function fmtCallTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return day === todayStr() ? `bugun ${time}` : `${p(d.getDate())}.${p(d.getMonth() + 1)} ${time}`;
}

export const isToday = (iso: string) => {
  const d = new Date(iso);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() === Number(todayStr().replace(/-/g, ""));
};

/** phoneKey → shu raqam bilan bo'lgan qo'ng'iroqlar (yangisi birinchi). */
export function groupCalls(calls: Call[]) {
  const map = new Map<string, Call[]>();
  for (const c of calls) {
    if (!c.phoneKey) continue;
    const list = map.get(c.phoneKey);
    if (list) list.push(c);
    else map.set(c.phoneKey, [c]);
  }
  return map;
}
