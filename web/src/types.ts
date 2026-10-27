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

/** GET /api/stats — boshliqlar dashboardi uchun jonli statistika. */
export type Stats = {
  generated_at: string;
  summary: [
    {
      leads: number;
      leads_called: number;
      leads_talked: number;
      rentmi_placed: number;
      tenants: number;
      calls_total: number;
      calls_out: number;
      calls_success: number;
      talk_seconds: number;
      avg_talk_seconds: number;
      operators: number;
      last_call_ms: number | null;
    },
  ];
  funnel: { stage: string; step: number; n: number }[];
  leads_by_day: { day: string; n: number }[];
  calls_by_day: { day: string; n: number; ok: number; outgoing: number; talk_seconds: number }[];
  calls_by_status: { status: string; direction: string; n: number; talk_seconds: number }[];
  calls_by_hour: { hour: number; n: number; ok: number }[];
  by_operator: { operator: string; leads: number; calls: number; success: number; talk_seconds: number; softphone: string; last_sync_ms: number | null }[];
  leads: {
    id: string;
    owner: string;
    house: string;
    stage: string;
    operator: string;
    result: string;
    olx_url: string;
    calls: number;
    last_call_ms: number | null;
    created_ms: number;
  }[];
};

/** GET /api/me va /api/users — parolsiz foydalanuvchi. */
export type User = {
  id: string;
  login: string;
  name: string;
  /** Dasturchi: hammasi + foydalanuvchilar */
  isAdmin: boolean;
  /** Kanban doskasiga kirish */
  canBoard: boolean;
  /** Boshliqlar dashboardiga kirish */
  canDashboard: boolean;
  /** Bog'langan Operator.name, "" = yo'q */
  operator: string;
  active: boolean;
  hasToken: boolean;
  createdAt: string;
};

/** Bayroqlardan UI ruxsatlari (server ham tekshiradi). */
export const can = (u: User | null) => ({
  board: !!u && (u.isAdmin || u.canBoard),
  dashboard: !!u && (u.isAdmin || u.canDashboard),
  users: !!u?.isAdmin,
  /** Ustunlar, import/export, operatorlar, mas'ulni istalgan odamga qo'yish */
  manage: !!u?.isAdmin,
});

/** Sidebar bandlari — ruxsati bor bo'limlar. 2 tadan kam bo'lsa sidebar ko'rsatilmaydi. */
export const sectionsFor = (u: User | null) => {
  const c = can(u);
  return [
    ...(c.board ? [{ to: "/", label: "Kanban" }] : []),
    ...(c.dashboard ? [{ to: "/dashboard", label: "Dashboard" }] : []),
    ...(c.users ? [{ to: "/users", label: "Foydalanuvchilar" }] : []),
  ];
};

/** Foydalanuvchi ruxsatlarini qisqa matn bilan: "Dasturchi" yoki "Kanban, Dashboard". */
export const accessLabel = (u: User) =>
  u.isAdmin ? "Dasturchi" : [u.canBoard && "Kanban", u.canDashboard && "Dashboard"].filter(Boolean).join(", ") || "Ruxsat yo'q";
