import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { sectionsFor, type User } from "../types";

/**
 * Sahifa qobig'i: foydalanuvchining 2 va undan ko'p bo'limga ruxsati bo'lsa chapda tor sidebar
 * (Kanban / Dashboard / Foydalanuvchilar). Bitta bo'lim bo'lsa sidebar yo'q — sahifa o'zi.
 */
export function Shell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    api.me().then(setUser).catch(() => {});
  }, []);
  const sections = sectionsFor(user);
  const path = location.pathname.replace(/\/+$/, "") || "/";
  if (sections.length < 2) return <>{children}</>;
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Bo'limlar">
        <div className="sb-logo" title="Uy egalari doskasi">
          <i />
        </div>
        {sections.map((s) => (
          <a key={s.to} href={s.to} className={"sb-item" + (path === s.to ? " on" : "")} title={s.label}>
            <Icon name={s.label} />
            <span>{s.label}</span>
          </a>
        ))}
        <a href="/logout" className="sb-item sb-out" title="Chiqish">
          <Icon name="Chiqish" />
          <span>Chiqish</span>
        </a>
      </nav>
      <div className="shell-main">{children}</div>
    </div>
  );
}

function Icon({ name }: { name: string }) {
  const p = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "Kanban":
      return (
        <svg {...p}>
          <rect x="3" y="4" width="5" height="16" rx="1.5" />
          <rect x="9.5" y="4" width="5" height="10" rx="1.5" />
          <rect x="16" y="4" width="5" height="13" rx="1.5" />
        </svg>
      );
    case "Dashboard":
      return (
        <svg {...p}>
          <path d="M4 19V11" />
          <path d="M10 19V5" />
          <path d="M16 19v-8" />
          <path d="M22 19H2" />
        </svg>
      );
    case "Foydalanuvchilar":
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 15.5a5 5 0 0 1 5.5 4.5" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
          <path d="M15 16l4-4-4-4" />
          <path d="M19 12H9" />
        </svg>
      );
  }
}
