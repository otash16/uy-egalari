export type Column = {
  id: string;
  name: string;
  color: number;
  order: number;
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
  columnId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type LeadInput = Pick<Lead, "ownerName" | "phone" | "houseName" | "olxUrl" | "rentmeUrl" | "note" | "nextCall" | "columnId">;

export type Board = { columns: Column[]; leads: Lead[] };

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
  id: number;
  direction: "in" | "out";
  status: CallStatus;
  number: string;
  phoneKey: string;
  startedAt: string;
  connectedAt: string | null;
  duration: number;
};
