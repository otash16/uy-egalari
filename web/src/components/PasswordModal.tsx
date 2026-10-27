import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { Modal } from "./Modal";

/** O'z parolini o'zgartirish. Boshqa qurilmalardagi sessiyalar yopiladi. */
export function PasswordModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== again) return setErr("Yangi parol ikki marta bir xil yozilmadi");
    setSaving(true);
    setErr("");
    try {
      await api.changePassword(current, next);
      onDone("Parol o'zgartirildi");
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Parolni o'zgartirish" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="p_cur">Joriy parol</label>
          <input id="p_cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus required />
        </div>
        <div className="row2">
          <div className="field">
            <label htmlFor="p_new">Yangi parol</label>
            <input id="p_new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} required />
          </div>
          <div className="field">
            <label htmlFor="p_again">Yana bir marta</label>
            <input id="p_again" type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" minLength={6} required />
          </div>
        </div>
        <p className="hint">Kamida 6 ta belgi. O'zgartirgach boshqa kompyuterlardagi kirishlar yopiladi.</p>
        {err && <p className="hint err">{err}</p>}
        <div className="foot">
          <span style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={onClose}>
            Bekor
          </button>
          <button className="btn primary" type="submit" disabled={saving}>
            Saqlash
          </button>
        </div>
      </form>
    </Modal>
  );
}
