import type { CallResult } from "../types";

export const CALL_RESULTS: { value: CallResult; label: string }[] = [
  { value: "", label: "Tanlanmagan" },
  { value: "no_answer", label: "Javob bermadi" },
  { value: "talked", label: "Gaplashildi" },
  { value: "declined", label: "Rad etdi" },
];

export const resultLabel = (r: CallResult) => CALL_RESULTS.find((x) => x.value === r)?.label ?? "";
