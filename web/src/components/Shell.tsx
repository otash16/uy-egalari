import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { accessLabel, sectionsFor, type User } from "../types";
import { Icon, Logo, type IconName } from "./Icon";
import { PasswordModal } from "./PasswordModal";

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const today = () => {
  const d = new Date();
  return `${d.getDate()}-${MONTHS[d.getMonth()]} · ${WEEKDAYS[d.getDay()]}`;
};
const ICONS: Record<string, IconName> = { Kanban: "kanban", Dashboard: "dashboard", Foydalanuvchilar: "users" };

function readCollapsed() {
  try {
    return localStorage.getItem("sb-collapsed") === "1";
  } catch {
    return false;
  }
}

/**
 * Ilova qobig'i (Dantist Team uslubi): chapda yig'iladigan sidebar, tepada topbar
 * (sana, foydalanuvchi menyusi: parol, chiqish), o'rtada sahifa.
 * Sidebar faqat 2 va undan ko'p bo'limga ruxsati borga chiqadi; bitta bo'lim — faqat topbar.
 * Telefonda sidebar chapdan chiqadigan panel (drawer).
 */
export function Shell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.me().then(setUser).catch(() => {});
  }, []);

  // Menyudan tashqariga bosilsa yopiladi
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => !(e.target as HTMLElement).closest(".tb-usermenu") && setMenu(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  const sections = sectionsFor(user);
  const hasSidebar = sections.length >= 2;
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const initial = (user?.name.trim()[0] ?? "?").toUpperCase();

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem("sb-collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });
  }
  function say(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2800);
  }

  const brand = (
    <a href="/" className="sb-brand" aria-label="Bosh sahifa">
      <Logo />
      <span>Uy egalari</span>
    </a>
  );

  return (
    <div className="app">
      {hasSidebar && (
        <>
          <div className={"scrim" + (drawer ? " on" : "")} onClick={() => setDrawer(false)} aria-hidden="true" />
          <aside className={"sidebar" + (collapsed ? " collapsed" : "") + (drawer ? " open" : "")} aria-label="Asosiy navigatsiya">
            <div className="sb-head">
              {brand}
              <button type="button" className="icon-btn sb-close" onClick={() => setDrawer(false)} aria-label="Menyuni yopish">
                <Icon name="close" size={20} />
              </button>
              <button type="button" className="icon-btn sb-toggle" onClick={toggleCollapsed} aria-label="Sidebarni yig'ish/ochish" title={collapsed ? "Ochish" : "Yig'ish"}>
                <Icon name="menu" size={20} />
              </button>
            </div>
            <nav className="sb-nav">
              <div className="sb-section">Asosiy</div>
              <ul>
                {sections.map((s) => (
                  <li key={s.to}>
                    <a href={s.to} className={"sb-item" + (path === s.to ? " on" : "")} title={collapsed ? s.label : undefined} aria-current={path === s.to ? "page" : undefined}>
                      <Icon name={ICONS[s.label] ?? "kanban"} />
                      <span>{s.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="sb-foot">
              <a href="/logout" className="sb-item" title={collapsed ? "Chiqish" : undefined}>
                <Icon name="logout" />
                <span>Chiqish</span>
              </a>
            </div>
          </aside>
        </>
      )}

      <div className="app-main">
        <header className="topbar">
          {hasSidebar ? (
            <button type="button" className="icon-btn tb-menu" onClick={() => setDrawer((o) => !o)} aria-label="Menyuni ochish/yopish" aria-expanded={drawer}>
              <Icon name="menu" size={20} />
            </button>
          ) : (
            brand
          )}
          <div className="tb-right">
            <div className="tb-date">
              <Icon name="calendar" size={16} />
              <span>{today()}</span>
            </div>
            <span className="tb-sep" />
            <div className="tb-usermenu">
              <button type="button" className="tb-user" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Foydalanuvchi menyusi">
                <span className="avatar">{initial}</span>
                <span className="nm">
                  <b>{user?.name ?? "…"}</b>
                  <small>{user ? accessLabel(user) + (user.operator ? ` · ${user.operator}` : "") : ""}</small>
                </span>
                <Icon name="chevron" size={16} />
              </button>
              {menu && user && (
                <div className="menu" onClick={() => setMenu(false)}>
                  <div className="menu-head">
                    <b>{user.name}</b>
                    <small>
                      {user.login} · {accessLabel(user)}
                    </small>
                  </div>
                  <button type="button" className="row" onClick={() => setPwOpen(true)}>
                    <Icon name="key" size={16} /> Parolni o'zgartirish
                  </button>
                  <div className="menu-sep" />
                  <a href="/logout" className="row">
                    <Icon name="logout" size={16} /> Chiqish
                  </a>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>

      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} onDone={say} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
