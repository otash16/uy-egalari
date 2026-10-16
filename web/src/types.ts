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
