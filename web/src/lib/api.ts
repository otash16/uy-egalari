import type { Board, Call, Column, Lead, LeadInput, Operator, Stats, SyncResult, User } from "../types";

async function request<T>(method: string, url: string, body?: unknown, contentType = "application/json"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": contentType },
      body: body === undefined ? undefined : contentType === "application/json" ? JSON.stringify(body) : (body as string),
    });
  } catch {
    throw new Error("Serverga ulanib bo'lmadi. Server turgan kompyuterda «yarn start» ishlab turganini tekshiring.");
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401) {
    // Sessiya tugagan — login sahifasiga
    location.href = "/login?next=" + encodeURIComponent(location.pathname + location.search);
    throw new Error("Kirish kerak");
  }
  if (!res.ok) throw new Error(data?.error ?? `Server xatosi (${res.status})`);
  return data as T;
}

export type UserInput = { login: string; name: string; isAdmin: boolean; canBoard: boolean; canDashboard: boolean; operator: string; password: string };

export const api = {
  me: () => request<User>("GET", "/api/me"),
  changePassword: (current: string, next: string) => request<{ ok: true }>("POST", "/api/me/password", { current, next }),

  users: () => request<User[]>("GET", "/api/users"),
  createUser: (data: UserInput) => request<User>("POST", "/api/users", data),
  updateUser: (id: string, data: Partial<UserInput> & { active?: boolean }) => request<User>("PATCH", `/api/users/${id}`, data),
  deleteUser: (id: string) => request<{ ok: true }>("DELETE", `/api/users/${id}`),
  userToken: (id: string) => request<{ token: string }>("GET", `/api/users/${id}/token`),
  newUserToken: (id: string) => request<{ token: string }>("POST", `/api/users/${id}/token`),

  board: () => request<Board>("GET", "/api/board"),
  calls: () => request<Call[]>("GET", "/api/calls"),
  stats: () => request<Stats>("GET", "/api/stats"),

  createLead: (data: LeadInput) => request<Lead>("POST", "/api/leads", data),
  updateLead: (id: string, data: Partial<LeadInput>) => request<Lead>("PATCH", `/api/leads/${id}`, data),
  deleteLead: (id: string) => request<{ ok: true }>("DELETE", `/api/leads/${id}`),
  moveLead: (id: string, columnId: string, beforeId: string | null) =>
    request<Lead>("POST", `/api/leads/${id}/move`, { columnId, beforeId }),

  createColumn: (data: { name: string; color: number }) => request<Column>("POST", "/api/columns", data),
  updateColumn: (id: string, data: { name: string; color: number }) => request<Column>("PATCH", `/api/columns/${id}`, data),
  moveColumn: (id: string, dir: -1 | 1) => request<{ ok: true }>("POST", `/api/columns/${id}/move`, { dir }),
  deleteColumn: (id: string) => request<{ ok: true; movedTo: string | null; moved: number }>("DELETE", `/api/columns/${id}`),

  operators: () => request<Operator[]>("GET", "/api/operators"),
  createOperator: (name: string) => request<Operator>("POST", "/api/operators", { name }),

  syncLocal: () => request<SyncResult>("POST", "/api/sync/local"),
  importCsv: (text: string) => request<{ created: number; updated: number }>("POST", "/api/import/csv", text, "text/csv"),
};
