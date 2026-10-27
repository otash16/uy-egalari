import { useEffect, useState } from "react";

const EVENT = "uy:navigate";

/** Joriy yo'l, oxirgi "/" siz: "/", "/dashboard", "/users". */
export const currentPath = () => location.pathname.replace(/\/+$/, "") || "/";

/** Sahifani qayta yuklamasdan boshqa bo'limga o'tish (history.pushState). */
export function navigate(to: string) {
  if (currentPath() === to) return;
  history.pushState(null, "", to);
  window.dispatchEvent(new Event(EVENT));
}

/** Joriy yo'lni kuzatadi: navigate() va brauzerning Orqaga/Oldinga tugmalari. */
export function usePath() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("popstate", onChange);
    window.addEventListener(EVENT, onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener(EVENT, onChange);
    };
  }, []);
  return path;
}
