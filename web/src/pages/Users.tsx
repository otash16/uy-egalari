import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type UserInput } from "../lib/api";
import { can, type Operator, type User } from "../types";
import { Modal } from "../components/Modal";

const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU");

/** /users — login, parol, rol va operator bog'lash. Faqat dasturchi. */
export function UsersPage() {
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [edit, setEdit] = useState<User | "new" | null>(null);
  const [token, setToken] = useState<{ user: User; token: string } | null>(null);

  const reload = useCallback(async () => {
    try {
      const [m, u, o] = await Promise.all([api.me(), api.users(), api.operators()]);
      setMe(m);
      setUsers(u);
      setOperators(o);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  function say(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2800);
  }
  async function run(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn();
      if (ok) say(ok);
      await reload();
      return true;
    } catch (e) {
      say((e as Error).message);
      return false;
    }
  }

  if (me && !can(me).users)
    return (
      <div className="users-page">
        <div className="banner">
          <span>Bu sahifa faqat dasturchi uchun.</span>
          <a className="btn" href="/">
            Doskaga
          </a>
        </div>
      </div>
    );

  return (
    <div className="users-page">
      <div className="top">
        <div className="brand">
          <h1>Foydalanuvchilar</h1>
          <span className="sub">Kim qaysi login bilan kiradi va nima qila oladi</span>
        </div>
        <div className="actions">
          <a className="btn" href="/">
            ← Doskaga
          </a>
          <button className="btn primary" type="button" onClick={() => setEdit("new")}>
            + Foydalanuvchi
          </button>
        </div>
      </div>
      {error && (
        <div className="banner">
          <span>{error}</span>
          <button className="btn" type="button" onClick={reload}>
            Qayta urinish
          </button>
        </div>
      )}
      <div className="users-body">
        <table className="users">
          <thead>
            <tr>
              <th>Ism</th>
              <th>Login</th>
              <th>Ruxsatlar</th>
              <th>Operator</th>
              <th>Holat</th>
              <th>Qo'shilgan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "off"}>
                <td>
                  <b>{u.name}</b>
                  {u.id === me?.id && <small> (siz)</small>}
                </td>
                <td className="mono">{u.login}</td>
                <td className="access">
                  {u.isAdmin ? (
                    <span className="role-chip dev">Dasturchi</span>
                  ) : (
                    <>
                      {u.canBoard && <span className="role-chip operator">Kanban</span>}
                      {u.canDashboard && <span className="role-chip pm">Dashboard</span>}
                      {!u.canBoard && !u.canDashboard && <span className="muted">ruxsat yo'q</span>}
                    </>
                  )}
                </td>
                <td>{u.operator || <span className="muted">—</span>}</td>
                <td>{u.active ? "Faol" : "O'chirilgan"}</td>
                <td className="muted">{fmtDate(u.createdAt)}</td>
                <td className="row-actions">
                  <button className="btn" type="button" onClick={() => setEdit(u)}>
                    Tahrirlash
                  </button>
                  {u.operator && (
                    <button className="btn" type="button" title="Softphone agenti uchun token" onClick={() => run(async () => setToken({ user: u, token: (await api.userToken(u.id)).token }))}>
                      Agent token
                    </button>
                  )}
                  {u.id !== me?.id && (
                    <button className="btn" type="button" onClick={() => run(() => api.updateUser(u.id, { active: !u.active }), u.active ? "Kirish yopildi" : "Kirish ochildi")}>
                      {u.active ? "O'chirish" : "Yoqish"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="roles-help">
          <div>
            <span className="role-chip dev">Dasturchi</span> <span className="muted">Hammasi: kanban, dashboard, ustunlar, import/export va foydalanuvchilar</span>
          </div>
          <div>
            <span className="role-chip operator">Kanban</span> <span className="muted">Doska: karta qo'shish, tahrirlash, surish. Mas'ulni faqat o'ziga qo'yadi, faqat o'z kartasini o'chiradi</span>
          </div>
          <div>
            <span className="role-chip pm">Dashboard</span> <span className="muted">Boshliqlar uchun voronka va statistika</span>
          </div>
        </div>
      </div>

      {edit && (
        <UserModal
          key={edit === "new" ? "new" : edit.id}
          user={edit === "new" ? null : edit}
          operators={operators}
          isSelf={edit !== "new" && edit.id === me?.id}
          onClose={() => setEdit(null)}
          onSave={async (data, id) => {
            const ok = await run(() => (id ? api.updateUser(id, data) : api.createUser(data as UserInput)), id ? "Saqlandi" : "Qo'shildi");
            if (ok) setEdit(null);
            return ok;
          }}
          onDelete={async (id) => {
            if (await run(() => api.deleteUser(id), "O'chirildi")) setEdit(null);
          }}
        />
      )}

      {token && (
        <Modal title={`Agent tokeni — ${token.user.name}`} onClose={() => setToken(null)}>
          <form onSubmit={(e) => e.preventDefault()}>
            <p className="hint">
              Sherikning kompyuteridagi <code>agent/config.json</code> faylida <code>"token"</code> maydoniga yoziladi. Operator: <b>{token.user.operator}</b>.
            </p>
            <div className="field">
              <span className="label">Token</span>
              <input readOnly value={token.token} onFocus={(e) => e.currentTarget.select()} className="mono" />
            </div>
            <div className="foot">
              <button
                className="btn"
                type="button"
                onClick={() =>
                  run(async () => setToken({ ...token, token: (await api.newUserToken(token.user.id)).token }), "Yangi token yaratildi, eskisi ishlamaydi")
                }
              >
                Yangi token
              </button>
              <span style={{ flex: 1 }} />
              <button className="btn primary" type="button" onClick={() => navigator.clipboard.writeText(token.token).then(() => say("Nusxalandi"))}>
                Nusxalash
              </button>
            </div>
          </form>
        </Modal>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

type ModalProps = {
  user: User | null;
  operators: Operator[];
  isSelf: boolean;
  onClose: () => void;
  onSave: (data: Partial<UserInput>, id?: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
};

function UserModal({ user, operators, isSelf, onClose, onSave, onDelete }: ModalProps) {
  const [form, setForm] = useState({
    login: user?.login ?? "",
    name: user?.name ?? "",
    isAdmin: user?.isAdmin ?? false,
    canBoard: user?.canBoard ?? true,
    canDashboard: user?.canDashboard ?? false,
    operator: user?.operator ?? "",
    password: "",
  });
  const [newOp, setNewOp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [armed, setArmed] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const data: Partial<UserInput> = {
      login: form.login.trim(),
      name: form.name.trim(),
      isAdmin: form.isAdmin,
      canBoard: form.canBoard,
      canDashboard: form.canDashboard,
      operator: form.operator.trim(),
    };
    if (form.password) data.password = form.password;
    await onSave(data, user?.id);
    setSaving(false);
  }

  return (
    <Modal title={user ? `Tahrirlash — ${user.name}` : "Yangi foydalanuvchi"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="row2">
          <div className="field">
            <label htmlFor="u_name">Ism</label>
            <input id="u_name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Akbar" autoFocus={!user} required />
          </div>
          <div className="field">
            <label htmlFor="u_login">Login</label>
            <input id="u_login" value={form.login} onChange={(e) => set("login", e.target.value.toLowerCase())} placeholder="akbar" autoCapitalize="none" spellCheck={false} required pattern="[a-z0-9._-]{2,32}" title="2–32 belgi: lotin harf, raqam, nuqta, chiziqcha" />
          </div>
        </div>
        <div className="field">
          <span className="label">Ruxsatlar</span>
          <div className="checks">
            <label className="check">
              <input type="checkbox" checked={form.isAdmin} onChange={(e) => set("isAdmin", e.target.checked)} disabled={isSelf} />
              <span>
                <b>Dasturchi</b>
                <small>hammasi + foydalanuvchilar</small>
              </span>
            </label>
            <label className={"check" + (form.isAdmin ? " dim" : "")}>
              <input type="checkbox" checked={form.isAdmin || form.canBoard} onChange={(e) => set("canBoard", e.target.checked)} disabled={form.isAdmin} />
              <span>
                <b>Kanban</b>
                <small>doska bilan ishlash</small>
              </span>
            </label>
            <label className={"check" + (form.isAdmin ? " dim" : "")}>
              <input type="checkbox" checked={form.isAdmin || form.canDashboard} onChange={(e) => set("canDashboard", e.target.checked)} disabled={form.isAdmin} />
              <span>
                <b>Dashboard</b>
                <small>boshliqlar statistikasi</small>
              </span>
            </label>
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label htmlFor="u_op">Operator (softphone)</label>
            {newOp ? (
              <input id="u_op" value={form.operator} onChange={(e) => set("operator", e.target.value)} placeholder="Yangi operator nomi" maxLength={40} autoFocus />
            ) : (
              <select
                id="u_op"
                value={form.operator}
                onChange={(e) => {
                  if (e.target.value === "__new") {
                    setNewOp(true);
                    set("operator", "");
                  } else set("operator", e.target.value);
                }}
              >
                <option value="">— yo'q (PM, kuzatuvchi) —</option>
                {operators.map((o) => (
                  <option key={o.name} value={o.name}>
                    {o.name}
                  </option>
                ))}
                {form.operator && !operators.some((o) => o.name === form.operator) && <option value={form.operator}>{form.operator}</option>}
                <option value="__new">+ Yangi operator…</option>
              </select>
            )}
          </div>
          <div className="field">
            <label htmlFor="u_pw">{user ? "Yangi parol (bo'sh qoldirsangiz o'zgarmaydi)" : "Parol"}</label>
            <input id="u_pw" type="text" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" minLength={6} required={!user} placeholder="kamida 6 ta belgi" className="mono" />
          </div>
        </div>
        <p className="hint">Operator bog'lansa uning kartalari va qo'ng'iroqlari shu nom bilan yoziladi; bog'lanmasa (masalan PM) faqat ko'radi.</p>
        <div className="foot">
          {user && !isSelf && (
            <button
              className={"btn danger" + (armed ? " armed" : "")}
              type="button"
              onClick={() => (armed ? onDelete(user.id) : setArmed(true))}
            >
              {armed ? "Rostdan o'chirilsinmi?" : "Butunlay o'chirish"}
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={onClose}>
            Bekor
          </button>
          <button className="btn primary" type="submit" disabled={saving}>
            {user ? "Saqlash" : "Qo'shish"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
