import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Board as BoardData, Column, Lead, LeadInput } from "./types";
import { api } from "./lib/api";
import { digits, matches, todayStr } from "./lib/text";
import { Board } from "./components/Board";
import { LeadModal } from "./components/LeadModal";
import { ColumnModal } from "./components/ColumnModal";

type LeadDialog = { lead?: Lead; columnId?: string; prefill?: Partial<LeadInput> };
type ColumnDialog = { column?: Column };

export default function App() {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [q, setQ] = useState("");
  const [leadDialog, setLeadDialog] = useState<LeadDialog | null>(null);
  const [columnDialog, setColumnDialog] = useState<ColumnDialog | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  }, []);

  const reload = useCallback(async () => {
    try {
      setBoard(await api.board());
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
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
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => !(e.target as HTMLElement).closest(".actions") && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

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

  const stats = useMemo(() => {
    const today = todayStr();
    return {
      total: leads.length,
      onRentmi: leads.filter((l) => l.rentmeUrl.trim()).length,
      due: leads.filter((l) => l.nextCall && l.nextCall <= today).length,
      found: q ? leads.filter((l) => matches(l, q)).length : 0,
    };
  }, [leads, q]);

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

  return (
    <>
      <div className="top">
        <div className="brand">
          <h1>Uy egalari doskasi</h1>
          <span className="sub">OLX e'lonlarini Rentmi'ga ko'chirish</span>
        </div>
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value.trimStart())} placeholder="Raqam, uy nomi, ism, OLX yoki Rentmi havolasi…  ( / )" autoComplete="off" aria-label="Qidirish" />
          {q && (
            <button className="clear" type="button" aria-label="Tozalash" onClick={() => setQ("")}>
              ×
            </button>
          )}
        </div>
        <div className="actions">
          <button className="btn" type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
            Ma'lumotlar ▾
          </button>
          <button className="btn primary" type="button" onClick={newLeadFromSearch}>
            + Uy egasi
          </button>
          {menuOpen && (
            <div className="menu" onClick={() => setMenuOpen(false)}>
              <button type="button" onClick={() => run(() => api.importLinphone(), (r) => (r.added ? `Linphone'dan ${r.added} ta yangi kontakt qo'shildi` : "Linphone'da yangi kontakt yo'q"))}>
                Linphone'dan yangilash
                <small>Yangi kontaktlar «{columns[0]?.name ?? "Yangi"}» ustuniga qo'shiladi</small>
              </button>
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

      <div className="stats">
        {board ? (
          <>
            {q && <span className="found">{stats.found} ta topildi</span>}
            <span>
              Jami <b>{stats.total}</b>
            </span>
            <span>
              Rentmi'ga joylangan <b>{stats.onRentmi}</b>
            </span>
            <span className={stats.due ? "due" : undefined}>
              Bugun qo'ng'iroq <b>{stats.due}</b>
            </span>
          </>
        ) : (
          <span>{loadError ? "Ma'lumot yo'q" : "Yuklanmoqda…"}</span>
        )}
      </div>

      {loadError && (
        <div className="banner">
          <span>{loadError}</span>
          <button className="btn" type="button" onClick={reload}>
            Qayta urinish
          </button>
        </div>
      )}

      {board && (
        <Board
          columns={columns}
          leads={leads}
          q={q}
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
          leads={leads}
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

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
