import type { Board, Call, Column, Lead, LeadInput } from "../types";

async function request<T>(method: string, url: string, body?: unknown, contentType = "application/json"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": contentType },
      body: body === undefined ? undefined : contentType === "application/json" ? JSON.stringify(body) : (body as string),
    });
  } catch {
    throw new Error("Serverga ulanib bo'lmadi. Terminalda «yarn start» ishlab turganini tekshiring.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Server xatosi (${res.status})`);
  return data as T;
}

export const api = {
  board: () => request<Board>("GET", "/api/board"),
  calls: () => request<Call[]>("GET", "/api/calls"),

  createLead: (data: LeadInput) => request<Lead>("POST", "/api/leads", data),
  updateLead: (id: string, data: Partial<LeadInput>) => request<Lead>("PATCH", `/api/leads/${id}`, data),
  deleteLead: (id: string) => request<{ ok: true }>("DELETE", `/api/leads/${id}`),
  moveLead: (id: string, columnId: string, beforeId: string | null) =>
    request<Lead>("POST", `/api/leads/${id}/move`, { columnId, beforeId }),

  createColumn: (data: { name: string; color: number }) => request<Column>("POST", "/api/columns", data),
  updateColumn: (id: string, data: { name: string; color: number }) => request<Column>("PATCH", `/api/columns/${id}`, data),
  moveColumn: (id: string, dir: -1 | 1) => request<{ ok: true }>("POST", `/api/columns/${id}/move`, { dir }),
  deleteColumn: (id: string) => request<{ ok: true; movedTo: string | null; moved: number }>("DELETE", `/api/columns/${id}`),

  importLinphone: () => request<{ total: number; added: number; duplicates: number; calls: number }>("POST", "/api/import/linphone"),
  importCsv: (text: string) => request<{ created: number; updated: number }>("POST", "/api/import/csv", text, "text/csv"),
};
