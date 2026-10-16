import type { DragEvent } from "react";
import type { Call, Lead } from "../types";
import { CallLine } from "./CallRow";
import { digits, fmtDateTime, fmtPhone, isPhoneQuery, safeHref, todayStr } from "../lib/text";

export function Highlight({ text, q }: { text: string; q: string }) {
  if (!q || q.length < 2) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

type Props = {
  lead: Lead;
  /** Shu raqam bilan bo'lgan qo'ng'iroqlar, yangisi birinchi */
  calls?: Call[];
  q: string;
  dragging: boolean;
  onOpen: () => void;
  onCopy: (text: string) => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
};

export function LeadCard({ lead: l, calls, q, dragging, onOpen, onCopy, onDragStart, onDragEnd }: Props) {
  const today = todayStr();
  const phone = fmtPhone(l.phone);
  const phoneHit = isPhoneQuery(q) && digits(l.phone).includes(digits(q));

  let due = null;
  if (l.nextCall) {
    if (l.nextCall < today) due = <span className="late">kechikkan</span>;
    else if (l.nextCall === today) due = <span className="today">bugun</span>;
    else due = <span>{l.nextCall.slice(5).split("-").reverse().join(".")}</span>;
  }

  return (
    <article
      className={"card" + (dragging ? " dragging" : "")}
      data-id={l.id}
      draggable
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onOpen()}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="name">
        <Highlight text={l.ownerName || "Ismsiz"} q={q} />
      </div>
      {l.houseName && (
        <div className="house">
          <Highlight text={l.houseName} q={q} />
        </div>
      )}
      {l.phone && (
        <div className="phone-row">
          <span className="phone">{phoneHit ? <mark>{phone}</mark> : phone}</span>
          <button
            className="copy"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopy(phone.replace(/\s/g, ""));
            }}
          >
            Nusxa
          </button>
        </div>
      )}
      <div className="links" onClick={(e) => e.stopPropagation()}>
        {l.olxUrl ? (
          <a className="chip olx" href={safeHref(l.olxUrl)} target="_blank" rel="noopener">
            OLX ↗
          </a>
        ) : (
          <span className="chip miss">OLX yo'q</span>
        )}
        {l.rentmeUrl ? (
          <a className="chip rm" href={safeHref(l.rentmeUrl)} target="_blank" rel="noopener">
            Rentmi ↗
          </a>
        ) : (
          <span className="chip miss">Rentmi yo'q</span>
        )}
      </div>
      {calls && calls.length > 0 && (
        <div className="card-calls" title={`Jami ${calls.length} ta qo'ng'iroq`}>
          <CallLine call={calls[0]} />
          {calls.length > 1 && <span className="total">· {calls.length} ta</span>}
        </div>
      )}
      {l.note && (
        <div className="note">
          <Highlight text={l.note} q={q} />
        </div>
      )}
      <div className="meta">
        {due && <>Qayta qo'ng'iroq: {due} · </>}
        {fmtDateTime(l.updatedAt)}
      </div>
    </article>
  );
}
