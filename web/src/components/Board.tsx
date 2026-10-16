import { Fragment, useState, type DragEvent } from "react";
import type { Call, Column, Lead } from "../types";
import { matches } from "../lib/text";
import { LeadCard } from "./LeadCard";

type Props = {
  columns: Column[];
  leads: Lead[];
  callsByKey: Map<string, Call[]>;
  q: string;
  onOpenLead: (lead: Lead) => void;
  onAddIn: (columnId: string) => void;
  onEditColumn: (column: Column) => void;
  onNewColumn: () => void;
  onMove: (leadId: string, columnId: string, beforeId: string | null) => void;
  onCopy: (text: string) => void;
};

type Drop = { columnId: string; beforeId: string | null };

export function Board({ columns, leads, callsByKey, q, onOpenLead, onAddIn, onEditColumn, onNewColumn, onMove, onCopy }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);

  const endDrag = () => {
    setDragId(null);
    setDrop(null);
  };

  function onDragOver(e: DragEvent<HTMLElement>, columnId: string) {
    if (!dragId) return;
    e.preventDefault();
    const cards = [...e.currentTarget.querySelectorAll<HTMLElement>(".card:not(.dragging)")];
    const before = cards.find((c) => {
      const r = c.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    const next = { columnId, beforeId: before?.dataset.id ?? null };
    if (next.columnId !== drop?.columnId || next.beforeId !== drop?.beforeId) setDrop(next);
  }

  function onDrop(e: DragEvent, columnId: string) {
    if (!dragId) return;
    e.preventDefault();
    const target = drop?.columnId === columnId ? drop : { columnId, beforeId: null };
    const id = dragId;
    endDrag();
    if (target.beforeId !== id) onMove(id, columnId, target.beforeId);
  }

  return (
    <div className="board">
      {columns.map((c) => {
        const all = leads.filter((l) => l.columnId === c.id);
        const list = q ? all.filter((l) => matches(l, q)) : all;
        const isOver = drop?.columnId === c.id;
        return (
          <section
            key={c.id}
            className={"col" + (q && !list.length ? " dim" : "")}
            onDragOver={(e) => onDragOver(e, c.id)}
            onDrop={(e) => onDrop(e, c.id)}
          >
            <div className="col-head">
              <span className="dot" style={{ background: `var(--c${c.color % 6})` }} />
              <span className="col-name" title={c.name}>
                {c.name}
              </span>
              <span className="count">
                {q ? `${list.length}/` : ""}
                {all.length}
              </span>
              <button className="icon-btn" type="button" onClick={() => onEditColumn(c)} aria-label="Ustunni tahrirlash">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            </div>
            <div className={"cards" + (isOver ? " over" : "")}>
              {list.map((l) => (
                <Fragment key={l.id}>
                  {isOver && drop?.beforeId === l.id && <div className="drop-line" />}
                  <LeadCard
                    lead={l}
                    calls={l.phoneKey ? callsByKey.get(l.phoneKey) : undefined}
                    q={q}
                    dragging={dragId === l.id}
                    onOpen={() => onOpenLead(l)}
                    onCopy={onCopy}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", l.id);
                      setDragId(l.id);
                    }}
                    onDragEnd={endDrag}
                  />
                </Fragment>
              ))}
              {isOver && drop?.beforeId === null && <div className="drop-line" />}
            </div>
            <button className="add-card" type="button" onClick={() => onAddIn(c.id)}>
              + Qo'shish
            </button>
          </section>
        );
      })}
      <button className="new-col" type="button" onClick={onNewColumn}>
        + Ustun qo'shish
      </button>
    </div>
  );
}
