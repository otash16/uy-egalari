import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { can, type Board as BoardData, type Call, type Column, type Lead, type LeadInput, type SyncResult, type SyncWarning, type User } from "./types";
import { api } from "./lib/api";
import { digits, fmtPhone, isPhoneQuery, matches, phoneKey } from "./lib/text";
import { isOnline, setOperators } from "./lib/operators";
import { Board } from "./components/Board";
import { LeadModal } from "./components/LeadModal";
import { ColumnModal } from "./components/ColumnModal";
import { CallsModal } from "./components/CallsModal";
import { Icon } from "./components/Icon";
import { SearchCalls, type UnknownNumber } from "./components/SearchCalls";
import { fmtCallTime, groupCalls, isTalked } from "./lib/calls";

type LeadDialog = { lead?: Lead; columnId?: string; prefill?: Partial<LeadInput> };
type ColumnDialog = { column?: Column };
type Alert = SyncWarning & { id: number; at: number };

export default function App() {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [callsOpen, setCallsOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [q, setQ] = useState("");
  /** Kirgan foydalanuvchi (login/parol bilan). me = unga bog'langan operator nomi. */
  const [user, setUser] = useState<User | null>(null);
  const me = user?.operator ?? "";
  const perms = can(user);
  /** Doska filtri: "" — hammasi, aks holda operator nomi */
  const [filterOp, setFilterOp] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [leadDialog, setLeadDialog] = useState<LeadDialog | null>(null);
  const [columnDialog, setColumnDialog] = useState<ColumnDialog | null>(null);
  /** Ochiq menyu: "" | "data" (Ma'lumotlar) */
  const [menu, setMenu] = useState<"" | "data">("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const alertId = useRef(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([api.board(), api.calls()]);
      setOperators(b.operators);
      setBoard(b);
      setCalls(c);
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    api
      .me()
      .then((u) => {
        // Kanbanga ruxsati yo'q (masalan faqat dashboard) — o'z sahifasiga
        if (!can(u).board) return location.replace(can(u).dashboard ? "/dashboard" : "/login");
        setUser(u);
      })
      .catch((e) => setLoadError((e as Error).message));
    reload();
  }, [reload]);

  const pushAlerts = useCallback((ws: SyncWarning[]) => {
    if (!ws.length) return;
    setAlerts((a) => [...ws.map((w) => ({ ...w, id: ++alertId.current, at: Date.now() })), ...a].slice(0, 20));
  }, []);

  // Agent (o'zimizniki yoki sherikniki) yangi kontakt/qo'ng'iroq yuborsa server xabar beradi — doskani yangilaymiz
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("sync", (e) => {
      const r = JSON.parse((e as MessageEvent).data) as SyncResult;
      if (r.added) showToast(r.added === 1 ? `${r.operator}: yangi uy egasi — ${r.names[0]}` : `${r.operator}: ${r.added} ta yangi uy egasi`);
      pushAlerts(r.warnings);
      reload();
    });
    // Server qayta ishga tushganda ulanish tiklanadi — orada o'tkazib yuborilgan o'zgarishlarni olamiz
    es.addEventListener("open", () => reload());
    return () => es.close();
  }, [reload, showToast, pushAlerts]);

  // Operatorlarning "ulangan" holati vaqt o'tishi bilan o'zgaradi — minutda bir yangilab turamiz
  useEffect(() => {
    const t = window.setInterval(reload, 60_000);
    return () => window.clearInterval(t);
  }, [reload]);

  // "/" — qidiruvga o'tish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? "";
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(tag) && !document.querySelector(".overlay")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Menyudan tashqariga bosilsa yopiladi
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => !(e.target as HTMLElement).closest(".dd") && setMenu("");
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  /** Amalni bajaradi, xabar ko'rsatadi va doskani serverdan qayta yuklaydi. */
  async function run(fn: () => Promise<unknown>, okMsg?: string | ((r: any) => string)) {
    try {
      const r = await fn();
      if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg);
      await reload();
      return true;
    } catch (e) {
      showToast((e as Error).message);
      await reload();
      return false;
    }
  }

  const columns = board?.columns ?? [];
  const leads = board?.leads ?? [];
  const operators = board?.operators ?? [];
  const callsByKey = useMemo(() => groupCalls(calls), [calls]);
  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const shown = useMemo(() => (filterOp ? leads.filter((l) => l.operator === filterOp) : leads), [leads, filterOp]);

  // Raqam bilan qidirilganda: doskada kartasi yo'q, lekin qo'ng'iroq bo'lgan raqamlar
  const unknownNumbers = useMemo<UnknownNumber[]>(() => {
    if (!isPhoneQuery(q)) return [];
    const dq = digits(q);
    const known = new Set(leads.map((l) => l.phoneKey).filter(Boolean));
    const out: UnknownNumber[] = [];
    for (const [key, list] of callsByKey) {
      if (known.has(key)) continue;
      if (digits(list[0].number).includes(dq) || key.includes(phoneKey(dq))) out.push({ phoneKey: key, number: list[0].number, calls: list });
    }
    return out.sort((a, b) => b.calls[0].startedAt.localeCompare(a.calls[0].startedAt));
  }, [q, leads, callsByKey]);

  const stats = useMemo(() => {
    return {
      total: leads.length,
      mine: leads.filter((l) => l.operator === me).length,
      found: q ? shown.filter((l) => matches(l, q)).length : 0,
      callsAll: calls.length,
      talkedAll: calls.filter(isTalked).length,
    };
  }, [leads, shown, calls, q, me]);

  function moveLead(id: string, columnId: string, beforeId: string | null) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    // Optimistik: kartani darrov joyiga qo'yamiz, keyin server bilan tekshiramiz
    const before = beforeId ? leads.find((l) => l.id === beforeId) : null;
    const tail = Math.max(0, ...leads.filter((l) => l.columnId === columnId).map((l) => l.order));
    const order = before ? before.order - 0.001 : tail + 1000;
    setBoard((b) => b && { ...b, leads: b.leads.map((l) => (l.id === id ? { ...l, columnId, order } : l)).sort((a, z) => a.order - z.order) });
    const colName = columns.find((c) => c.id === columnId)?.name;
    run(() => api.moveLead(id, columnId, beforeId), lead.columnId !== columnId ? `«${colName}» ga o'tkazildi` : undefined);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Nusxalandi: " + text);
    } catch {
      showToast("Nusxalab bo'lmadi, raqamni belgilab oling");
    }
  }

  function newLeadFromSearch() {
    if (!columns.length) return showToast("Avval ustun yarating");
    const prefill: Partial<LeadInput> = {};
    if (/[./]/.test(q)) {
      if (/rentmi/i.test(q)) prefill.rentmeUrl = q;
      else prefill.olxUrl = q;
    } else if (digits(q).length >= 7) prefill.phone = q;
    setLeadDialog({ prefill });
  }

  async function importCsvFile(file: File) {
    const text = await file.text();
    await run(() => api.importCsv(text), (r) => `CSV: ${r.created} ta yangi, ${r.updated} ta yangilandi`);
  }

  const localOp = board?.localOperator ?? null;

  return (
    <div className="kanban">
      <div className="page-head">
        <div>
          <h1>Kanban</h1>
          <p>OLX e'lonlarini Rentmi'ga ko'chirish: uy egasidan ijarachigacha</p>
        </div>
        <div className="page-actions">
          <button className="btn" type="button" onClick={() => setCallsOpen(true)}>
            <Icon name="phone" size={16} /> Qo'ng'iroqlar
          </button>
          {perms.manage && (
            <div className="dd">
              <button className="btn" type="button" onClick={() => setMenu((m) => (m === "data" ? "" : "data"))} aria-expanded={menu === "data"}>
                <Icon name="database" size={16} /> Ma'lumotlar <Icon name="chevron" size={14} />
              </button>
              {menu === "data" && (
                <div className="menu" onClick={() => setMenu("")}>
                  {localOp && (
                    <button
                      type="button"
                      onClick={() =>
                        run(
                          () => api.syncLocal(),
                          (r: SyncResult) => {
                            pushAlerts(r.warnings);
                            return r.added || r.calls ? `${r.operator}: ${r.added} ta yangi kontakt, ${r.calls} ta yangi qo'ng'iroq` : "Softphone'da yangi narsa yo'q";
                          },
                        )
                      }
                    >
                      Softphone'dan yangilash
                      <small>
                        {localOp}ning kontaktlari «{columns[0]?.name ?? "Yangi"}» ustuniga qo'shiladi
                      </small>
                    </button>
                  )}
                  <a href="/api/export.csv" download>
                    CSV yuklab olish
                    <small>Excel uchun zaxira nusxa</small>
                  </a>
                  <button type="button" onClick={() => fileRef.current?.click()}>
                    CSV'dan import
                    <small>Eski doskadan olingan CSV: raqami borlar yangilanadi</small>
                  </button>
                  <button type="button" onClick={() => setColumnDialog({})}>
                    Yangi ustun
                    <small>Kanbanga bosqich qo'shish</small>
                  </button>
                </div>
              )}
            </div>
          )}
          <button className="btn primary" type="button" onClick={newLeadFromSearch}>
            <Icon name="plus" size={16} strokeWidth={2.2} /> Uy egasi
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) importCsvFile(f);
            }}
          />
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value.trimStart())} placeholder="Raqam, uy nomi, ism, OLX yoki Rentmi havolasi…  ( / )" autoComplete="off" aria-label="Qidirish" />
          {q && (
            <button className="clear" type="button" aria-label="Tozalash" onClick={() => setQ("")}>
              ×
            </button>
          )}
        </div>
      <div className="stats">
        {board ? (
          <>
            {q && <span className="found">{stats.found} ta topildi</span>}
            <span className="filters" role="group" aria-label="Operator bo'yicha filtr">
              <button type="button" className={"chip-f" + (filterOp === "" ? " on" : "")} onClick={() => setFilterOp("")}>
                Hammasi <b>{stats.total}</b>
              </button>
              {operators.map((o) => (
                <button
                  key={o.name}
                  type="button"
                  className={"chip-f" + (filterOp === o.name ? " on" : "")}
                  onClick={() => setFilterOp(filterOp === o.name ? "" : o.name)}
                  title={o.lastSyncAt ? `Softphone: oxirgi aloqa ${fmtCallTime(o.lastSyncAt)}` : "Softphone agenti hali ulanmagan"}
                >
                  <span className={"online" + (isOnline(o) ? " yes" : "")} />
                  {o.name === me ? "Meniki" : o.name} <b>{leads.filter((l) => l.operator === o.name).length}</b>
                </button>
              ))}
            </span>
            <button type="button" className="stat-link" onClick={() => setCallsOpen(true)}>
              Jami qo'ng'iroq <b>{stats.callsAll}</b>, gaplashildi <b>{stats.talkedAll}</b>
            </button>
          </>
        ) : (
          <span>{loadError ? "Ma'lumot yo'q" : "Yuklanmoqda…"}</span>
        )}
        </div>
      </div>

      {loadError && (
        <div className="banner">
          <span>{loadError}</span>
          <button className="btn" type="button" onClick={reload}>
            Qayta urinish
          </button>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="alerts" role="alert">
          {alerts.map((a) => {
            const lead = leadById.get(a.lead.id);
            return (
              <div key={a.id} className="alert">
                <span className="alert-ic">⚠</span>
                <span className="alert-text">
                  <b>{a.operator}</b> {a.kind === "call" ? "qo'ng'iroq qildi" : "kontakt qo'shdi"}: <span className="phone">{fmtPhone(a.number)}</span> — bu{" "}
                  <b>{a.lead.operator}</b>ning uy egasi (<i>{a.lead.ownerName || "Ismsiz"}</i>, {a.lead.columnName})
                  {a.lastCall && (
                    <>
                      . Oxirgi qo'ng'iroq: {a.lastCall.operator}, {fmtCallTime(a.lastCall.startedAt)}
                    </>
                  )}
                </span>
                {lead && (
                  <button type="button" className="btn" onClick={() => setLeadDialog({ lead })}>
                    Kartani ochish
                  </button>
                )}
                <button type="button" className="icon-btn" aria-label="Yopish" onClick={() => setAlerts((xs) => xs.filter((x) => x.id !== a.id))}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {board && <SearchCalls items={unknownNumbers} me={me} onCreate={(number) => setLeadDialog({ prefill: { phone: number } })} />}

      {board && (
        <Board
          columns={columns}
          leads={shown}
          callsByKey={callsByKey}
          q={q}
          me={me}
          canEditColumns={perms.manage}
          onOpenLead={(lead) => setLeadDialog({ lead })}
          onAddIn={(columnId) => setLeadDialog({ columnId })}
          onEditColumn={(column) => setColumnDialog({ column })}
          onNewColumn={() => setColumnDialog({})}
          onMove={moveLead}
          onCopy={copy}
        />
      )}

      {leadDialog && (
        <LeadModal
          key={leadDialog.lead?.id ?? "new"}
          {...leadDialog}
          columns={columns}
          operators={operators}
          me={me}
          anyOperator={perms.manage}
          canDelete={(l) => perms.manage || !l.operator || l.operator === me}
          leads={leads}
          callsByKey={callsByKey}
          onClose={() => setLeadDialog(null)}
          onSave={(data, id) =>
            run(() => (id ? api.updateLead(id, data) : api.createLead(data)), id ? "Saqlandi" : "Qo'shildi")
          }
          onDelete={(id) => run(() => api.deleteLead(id), "O'chirildi")}
          onOpenOther={(lead) => setLeadDialog({ lead })}
        />
      )}

      {columnDialog && (
        <ColumnModal
          key={columnDialog.column?.id ?? "new"}
          column={columnDialog.column && columns.find((c) => c.id === columnDialog.column!.id)}
          columns={columns}
          leadCount={columnDialog.column ? leads.filter((l) => l.columnId === columnDialog.column!.id).length : 0}
          onClose={() => setColumnDialog(null)}
          onSave={(data) => {
            const id = columnDialog.column?.id;
            return run(() => (id ? api.updateColumn(id, data) : api.createColumn(data)), id ? "Ustun saqlandi" : "Ustun qo'shildi");
          }}
          onMove={(dir) => columnDialog.column && run(() => api.moveColumn(columnDialog.column!.id, dir))}
          onDelete={() =>
            run(
              () => api.deleteColumn(columnDialog.column!.id),
              (r) => (r.moved ? `Ustun o'chirildi, ${r.moved} ta karta «${r.movedTo}» ga o'tdi` : "Ustun o'chirildi"),
            )
          }
        />
      )}

      {callsOpen && (
        <CallsModal
          calls={calls}
          leads={leads}
          me={me}
          onClose={() => setCallsOpen(false)}
          onOpenLead={(lead) => {
            setCallsOpen(false);
            setLeadDialog({ lead });
          }}
          onCreateFrom={(number) => {
            setCallsOpen(false);
            setLeadDialog({ prefill: { phone: number } });
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
