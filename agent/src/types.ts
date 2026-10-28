/** Agent → server yuboriladigan ma'lumotlar (POST /api/sync). */

/** asterisk — serverning o'zi PBX jurnalidan o'qiydi (agent emas) */
export type Softphone = "linphone" | "microsip" | "asterisk";

export type SyncContact = {
  /** Softphone'dagi kontakt id (matn) */
  extId: string;
  name: string;
  phone: string;
  olxUrl: string;
};

export type SyncCall = {
  /** Softphone'dagi qo'ng'iroq id (matn) */
  extId: string;
  direction: "in" | "out";
  /** success | aborted | missed | declined | early_aborted | accepted_elsewhere | declined_elsewhere | unknown */
  status: string;
  /** Qarshi tomon raqami (SIP user qismi) */
  number: string;
  /** ISO 8601 */
  startedAt: string;
  connectedAt: string | null;
  /** soniya */
  duration: number;
};

export type SyncPayload = {
  operator: string;
  softphone: Softphone;
  contacts: SyncContact[];
  calls: SyncCall[];
};

export type SyncWarning = {
  kind: "contact" | "call";
  /** Kim qo'shdi / qo'ng'iroq qildi */
  operator: string;
  number: string;
  lead: { id: string; ownerName: string; operator: string; columnName: string };
  /** Shu raqam bilan oxirgi qo'ng'iroq (boshqa operatorniki) */
  lastCall: { operator: string; startedAt: string; status: string } | null;
};

export type SyncResult = {
  operator: string;
  total: number;
  added: number;
  duplicates: number;
  names: string[];
  calls: number;
  warnings: SyncWarning[];
};

/** Softphone o'quvchisi: o'zgarishni arzon aniqlash (signature) va to'liq o'qish (read). */
export type Source = {
  softphone: Softphone;
  /** Qayerdan o'qiyapti (log uchun) */
  location: string;
  /** Kontaktlar/qo'ng'iroqlar soni va oxirgi id — o'zgarsa qayta o'qiladi */
  signature(): string;
  /** afterCallId'dan katta id'li qo'ng'iroqlar va barcha kontaktlar */
  read(afterCallId: number): { contacts: SyncContact[]; calls: SyncCall[]; maxCallId: number };
  /** Ishga tushganda oynaga yoziladigan tashxis: qaysi fayllar topildi, nechta kontakt o'qildi */
  diagnose?(): string;
};
