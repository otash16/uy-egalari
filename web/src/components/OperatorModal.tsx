import { useState, type FormEvent } from "react";
import type { Operator } from "../types";
import { Modal } from "./Modal";
import { opColor } from "../lib/operators";

type Props = {
  operators: Operator[];
  current: string;
  onPick: (name: string) => Promise<boolean>;
  onClose?: () => void;
};

/** "Siz kimsiz?" — doskada kim ishlayotganini tanlash. Yangi karta shu operator nomiga yoziladi. */
export function OperatorModal({ operators, current, onPick, onClose }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    await onPick(n);
    setSaving(false);
  }

  return (
    <Modal title="Siz kimsiz?" onClose={onClose ?? (() => {})}>
      <div className="op-pick">
        <p className="hint">Siz qo'shgan kartalar va qo'ng'iroqlar shu nom bilan belgilanadi. Har kompyuterda bir marta tanlanadi.</p>
        <div className="op-list">
          {operators.map((o) => (
            <button key={o.name} type="button" className={"op-choice" + (o.name === current ? " on" : "")} style={{ "--op": opColor(o.name) } as React.CSSProperties} onClick={() => onPick(o.name)}>
              <span className="op-dot" />
              {o.name}
              {o.softphone && <small>{o.softphone === "linphone" ? "Linphone" : "MicroSIP"}</small>}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="op-new">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Yangi ism, masalan: Akbar" maxLength={40} autoComplete="off" />
          <button className="btn primary" type="submit" disabled={saving || !name.trim()}>
            Qo'shish
          </button>
        </form>
      </div>
    </Modal>
  );
}
