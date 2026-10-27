import type { SVGProps } from "react";

export type IconName = "menu" | "close" | "calendar" | "chevron" | "key" | "logout" | "kanban" | "dashboard" | "users" | "search" | "phone" | "plus" | "edit" | "database" | "home" | "user" | "lock" | "check";

/** Chiziqli ikonkalar (Remix Icon uslubi, 1.8px). Tashqi kutubxonasiz. */
export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...rest };
  switch (name) {
    case "menu":
      return <svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "close":
      return <svg {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>;
    case "calendar":
      return <svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
    case "chevron":
      return <svg {...p}><path d="m6 9 6 6 6-6" /></svg>;
    case "key":
      return <svg {...p}><circle cx="8" cy="15" r="4.5" /><path d="M11.5 11.5 20 3M16 7l3 3M13.5 9.5l3 3" /></svg>;
    case "logout":
      return <svg {...p}><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M15 16l4-4-4-4" /><path d="M19 12H9" /></svg>;
    case "kanban":
      return <svg {...p}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="9.5" y="4" width="5" height="10" rx="1.5" /><rect x="16" y="4" width="5" height="13" rx="1.5" /></svg>;
    case "dashboard":
      return <svg {...p}><path d="M4 19V11" /><path d="M10 19V5" /><path d="M16 19v-8" /><path d="M22 19H2" /></svg>;
    case "users":
      return <svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 15.5a5 5 0 0 1 5.5 4.5" /></svg>;
    case "search":
      return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case "phone":
      return <svg {...p}><path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L16 14l4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z" /></svg>;
    case "plus":
      return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
    case "edit":
      return <svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
    case "database":
      return <svg {...p}><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>;
    case "home":
      return <svg {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10" /><path d="M10 20v-6h4v6" /></svg>;
    case "user":
      return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></svg>;
    case "lock":
      return <svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
    case "check":
      return <svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
  }
}

/** Brend belgisi: ko'k kvadrat ichida uy. */
export function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      <Icon name="home" size={20} strokeWidth={2.2} />
    </span>
  );
}
