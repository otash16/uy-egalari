export type Column = {
  id: string;
  name: string;
  color: number;
  order: number;
};

/** Call-center operatori. Karta va qo'ng'iroqlar nomi bo'yicha bog'lanadi. */
export type Operator = {
  name: string;
  color: number;
  softphone: "linphone" | "microsip" | "";
  lastSyncAt: string | null;
  createdAt: string;
};

export type Lead = {
  id: string;
  ownerName: string;
  phone: string;
  phoneKey: string;
  houseName: string;
  olxUrl: string;
  rentmeUrl: string;
  note: string;
  nextCall: string;
  callResult: CallResult;
  /** Mas'ul operator (Operator.name), "" = belgilanmagan */
  operator: string;
  columnId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

/** Uy egasi bilan suhbat natijasi — qo'lda tanlanadi. "" = tanlanmagan. */
export type CallResult = "" | "no_answer" | "talked" | "declined";

export type LeadInput = Pick<Lead, "ownerName" | "phone" | "houseName" | "olxUrl" | "rentmeUrl" | "note" | "nextCall" | "callResult" | "columnId" | "operator">;

export type Board = { columns: Column[]; leads: Lead[]; operators: Operator[]; localOperator: string | null };

export type CallStatus =
  | "success"
  | "aborted"
  | "missed"
  | "declined"
  | "early_aborted"
  | "accepted_elsewhere"
  | "declined_elsewhere"
  | "unknown";

export type Call = {
  id: string;
  /** Kimning softphone'idan */
  operator: string;
  direction: "in" | "out";
  status: CallStatus;
  number: string;
  phoneKey: string;
  startedAt: string;
  connectedAt: string | null;
  duration: number;
};

/** Serverdan: operator boshqa operatorning uy egasini qo'shdi yoki unga qo'ng'iroq qildi. */
export type SyncWarning = {
  kind: "contact" | "call";
  operator: string;
  number: string;
  lead: { id: string; ownerName: string; operator: string; columnName: string };
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
