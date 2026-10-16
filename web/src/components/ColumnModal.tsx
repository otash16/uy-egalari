import { useState, type FormEvent } from "react";
import type { Column } from "../types";
import { Modal } from "./Modal";

type Props = {
  column?: Column;
  columns: Column[];
  leadCount: number;
  onClose: () => void;
  onSave: (data: { name: string; color: number }) => Promise<boolean>;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => Promise<boolean>;
};

export function ColumnModal({ column, columns, leadCount, onClose, onSave, onMove, onDelete }: Props) {
  const [name, setName] = useState(column?.name ?? "");
  const [color, setColor] = useState(column ? column.color % 6 : (columns.length + 1) % 6);
  const [armed, setArmed] = useState(false);

  const index = column ? columns.findIndex((c) => c.id === column.id) : -1;
  const others = columns.filter((c) => c.id !== column?.id);
  const blocked = leadCount > 0 && others.length === 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await onSave({ name, color })) onClose();
  }

  return (
    <Modal title={column ? "Ustunni tahrirlash" : "Yangi ustun"} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="c_name">Nomi</label>
          <input id="c_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Qayta qo'ng'iroq" autoFocus autoComplete="off" />
        </div>
        <div className="field">
          <span className="label">Rang</span>
          <div className="swatches">
            {Array.from({ length: 6 }, (_, i) => (
              <button key={i} type="button" className="swatch" aria-pressed={color === i} aria-label={`Rang ${i + 1}`} style={{ background: `var(--c${i})` }} onClick={() => setColor(i)} />
            ))}
          </div>
        </div>
        {column && (
          <div className="field">
            <span className="label">Joyi</span>
            <div className="foot" style={{ paddingTop: 0 }}>
              <button className="btn" type="button" disabled={index <= 0} onClick={() => onMove(-1)}>
                ← Chapga
              </button>
              <button className="btn" type="button" disabled={index >= columns.length - 1} onClick={() => onMove(1)}>
                O'ngga →
              </button>
            </div>
          </div>
        )}
        {column && blocked && <div className="hint">Bu oxirgi ustun va ichida kartalar bor. Avval boshqa ustun yarating.</div>}
        {column && armed && leadCount > 0 && !blocked && (
          <div className="hint">
            Ichidagi {leadCount} ta karta «{others[0].name}» ustuniga o'tkaziladi.
          </div>
        )}
        <div className="foot">
          {column && (
            <button
              className={"btn danger" + (armed ? " armed" : "")}
              type="button"
              disabled={blocked}
              onClick={async () => {
                if (!armed) return setArmed(true);
                if (await onDelete()) onClose();
              }}
            >
              {armed ? "Rostdan o'chirilsinmi?" : "O'chirish"}
            </button>
          )}
          <span className="spacer" />
          <button className="btn ghost" type="button" onClick={onClose}>
            Bekor
          </button>
          <button className="btn primary" type="submit">
            Saqlash
          </button>
        </div>
      </form>
    </Modal>
  );
}
