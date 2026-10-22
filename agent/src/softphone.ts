import { linphoneSource } from "./linphone.js";
import { microsipSource } from "./microsip.js";
import type { Softphone, Source } from "./types.js";

export type { Source, SyncPayload, SyncResult, SyncWarning, SyncCall, SyncContact, Softphone } from "./types.js";

/** Softphone turi va (ixtiyoriy) yo'l bo'yicha o'quvchi yaratadi. */
export function createSource(softphone: Softphone, customPath?: string): Source {
  if (softphone === "linphone") return linphoneSource(customPath || undefined);
  if (softphone === "microsip") return microsipSource(customPath || undefined);
  throw new Error(`Noma'lum softphone: ${softphone} (linphone yoki microsip bo'lishi kerak)`);
}
