import { useMemo, useState, type FormEvent } from "react";
import type { Column, Lead, LeadInput } from "../types";
import { fmtDateTime, fmtPhone, normUrl, olxTitle, phoneKey, safeHref } from "../lib/text";
import { Modal } from "./Modal";

type Props = {
  lead?: Lead;
  columnId?: string;
  prefill?: Partial<LeadInput>;
  columns: Column[];
  leads: Lead[];
  onClose: () => void;
  onSave: (data: LeadInput, id?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onOpenOther: (lead: Lead) => void;
};

export function LeadModal({ lead, columnId, prefill, columns, leads, onClose, onSave, onDelete, onOpenOther }: Props) {
  const [form, setForm] = useState<LeadInput>(() => ({
    ownerName: lead?.ownerName ?? "",
    phone: lead?.phone ? fmtPhone(lead.phone) : "",
    houseName: lead?.houseName ?? "",
    olxUrl: lead?.olxUrl ?? "",
    rentmeUrl: lead?.rentmeUrl ?? "",
    note: lead?.note ?? "",
    nextCall: lead?.nextCall ?? "",
    columnId: lead?.columnId ?? columnId ?? columns[0]?.id ?? "",
    ...prefill,
    // Qidiruvdan OLX havolasi bilan ochilgan yangi kartada uy nomi darrov to'ladi
    ...(prefill?.olxUrl && !prefill.houseName ? { houseName: olxTitle(prefill.olxUrl) } : {}),
  }));
  const [autoHouse, setAutoHouse] = useState(() => (prefill?.olxUrl && !prefill.houseName ? olxTitle(prefill.olxUrl) : ""));
  const [saving, setSaving] = useState(false);
  const [armed, setArmed] = useState(false);

  const set = <K extends keyof LeadInput>(k: K, v: LeadInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  /** OLX havolasi o'zgarsa uy nomini to'ldiradi — agar uni foydalanuvchi qo'lda yozmagan bo'lsa. */
  function onOlxChange(v: string) {
    const t = olxTitle(v);
    const cur = form.houseName.trim();
    if (t && (!cur || cur === autoHouse)) {
      setAutoHouse(t);
      setForm((f) => ({ ...f, olxUrl: v, houseName: t }));
    } else set("olxUrl", v);
  }
  const olxName = olxTitle(form.olxUrl);
  const houseFromOlx = olxName && form.houseName.trim() === olxName && olxName === autoHouse;
  const olxDiffers = olxName && form.houseName.trim() && form.houseName.trim() !== olxName;

  const duplicates = useMemo(() => {
    const pk = phoneKey(form.phone);
    const olx = normUrl(form.olxUrl);
    const rm = normUrl(form.rentmeUrl);
    return leads
      .filter((l) => l.id !== lead?.id)
      .map((l) => {
        const why: string[] = [];
        if (pk.length >= 9 && phoneKey(l.phone) === pk) why.push("raqam");
        if (olx.length > 8 && normUrl(l.olxUrl) === olx) why.push("OLX havola");
        if (rm.length > 8 && normUrl(l.rentmeUrl) === rm) why.push("Rentmi havola");
        return { l, why };
      })
      .filter((d) => d.why.length);
  }, [form.phone, form.olxUrl, form.rentmeUrl, leads, lead?.id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave(form, lead?.id);
    setSaving(false);
    if (ok) onClose();
  }

  const colName = (id: string) => columns.find((c) => c.id === id)?.name ?? "—";

  return (
    <Modal title={lead ? "Uy egasini tahrirlash" : "Yangi uy egasi"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="row2">
          <div className="field">
            <label htmlFor="f_name">Ism</label>
            <input id="f_name" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Sherzod aka" autoFocus={!lead} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="f_phone">Telefon</label>
            <input id="f_phone" className="mono" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+998 90 123 45 67" autoComplete="off" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="f_house">Uy nomi</label>
          <input id="f_house" value={form.houseName} onChange={(e) => set("houseName", e.target.value)} placeholder="OLX havolasini qo'ysangiz o'zi to'ladi" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="f_olx">OLX e'loni</label>
          <div className="url-wrap">
            <input id="f_olx" className="mono" value={form.olxUrl} onChange={(e) => onOlxChange(e.target.value)} placeholder="https://www.olx.uz/d/oz/obyavlenie/…" autoComplete="off" />
            <a href={safeHref(form.olxUrl) || undefined} aria-disabled={!form.olxUrl.trim()} target="_blank" rel="noopener" aria-label="OLX e'lonini ochish">
              ↗
            </a>
          </div>
          {houseFromOlx && <div className="hint ok">Uy nomi OLX havolasidan olindi ✓</div>}
          {olxDiffers && (
            <div className="hint">
              OLX'dagi nomi: «{olxName}»{" "}
              <button
                type="button"
                onClick={() => {
                  setAutoHouse(olxName);
                  set("houseName", olxName);
                }}
              >
                Shuni qo'yish
              </button>
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="f_rm">Rentmi e'loni</label>
          <div className="url-wrap">
            <input id="f_rm" className="mono" value={form.rentmeUrl} onChange={(e) => set("rentmeUrl", e.target.value)} placeholder="https://rentmi.uz/announcement/…" autoComplete="off" />
            <a href={safeHref(form.rentmeUrl) || undefined} aria-disabled={!form.rentmeUrl.trim()} target="_blank" rel="noopener" aria-label="Rentmi e'lonini ochish">
              ↗
            </a>
          </div>
        </div>
        {duplicates.length > 0 && (
          <div className="dup">
            {duplicates.map(({ l, why }, i) => (
              <span key={l.id}>
                {i > 0 && "; "}Bu {why.join(" va ")} allaqachon bor:{" "}
                <button type="button" onClick={() => onOpenOther(l)}>
                  {l.ownerName || "Ismsiz"}
                </button>{" "}
                ({colName(l.columnId)})
              </span>
            ))}
          </div>
        )}
        <div className="row2">
          <div className="field">
            <label htmlFor="f_col">Bosqich</label>
            <select id="f_col" value={form.columnId} onChange={(e) => set("columnId", e.target.value)}>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f_next">Qayta qo'ng'iroq</label>
            <input id="f_next" type="date" value={form.nextCall} onChange={(e) => set("nextCall", e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="f_note">Izoh</label>
          <textarea id="f_note" value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Narxi, gaplashilgan vaqt, e'tirozlar…" />
        </div>
        <div className="foot">
          {lead && (
            <button
              className={"btn danger" + (armed ? " armed" : "")}
              type="button"
              onClick={async () => {
                if (!armed) return setArmed(true);
                if (await onDelete(lead.id)) onClose();
              }}
            >
              {armed ? "Rostdan o'chirilsinmi?" : "O'chirish"}
            </button>
          )}
          {lead && <span className="hint">O'zgartirilgan: {fmtDateTime(lead.updatedAt)}</span>}
          <span className="spacer" />
          <button className="btn ghost" type="button" onClick={onClose}>
            Bekor
          </button>
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
