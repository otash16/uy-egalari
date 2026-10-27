import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export type SelectOption = { value: string; label: string; hint?: string };

type Props = {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Brauzerning oddiy <select> o'rniga dizayn-tizimga mos ochiladigan ro'yxat.
 * Ro'yxat portal orqali body'ga chiziladi, shuning uchun modal ichidagi scroll uni kesmaydi.
 * Klaviatura: ↑/↓ — yurish, Enter/Space — tanlash, Esc — yopish, harf — qidirish.
 */
export function Select({ id, value, options, onChange, placeholder = "— tanlang —", disabled, className, "aria-label": ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean }>({ top: 0, left: 0, width: 0, up: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();
  const current = options.find((o) => o.value === value);

  function place() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const need = Math.min(options.length, 8) * 36 + 12;
    const up = window.innerHeight - r.bottom < need + 8 && r.top > need + 8;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: r.width, up });
  }

  function show() {
    if (disabled) return;
    place();
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function pick(v: string) {
    setOpen(false);
    if (v !== value) onChange(v);
    btnRef.current?.focus();
  }

  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const n = options.length;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => (a + 1) % n);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => (a - 1 + n) % n);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(n - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (options[active]) pick(options[active].value);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const now = Date.now();
          typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
          const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
          if (i >= 0) setActive(i);
        }
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        className={"sel" + (open ? " open" : "") + (current ? "" : " empty") + (className ? " " + className : "")}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        <span className="sel-text">{current ? current.label : placeholder}</span>
        <Icon name="chevron" size={16} className="sel-chev" />
      </button>
      {open &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className={"sel-menu" + (pos.up ? " up" : "")}
            style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
            aria-activedescendant={`${listId}-${active}`}
          >
            {options.map((o, i) => (
              <li
                key={o.value || "__empty"}
                id={`${listId}-${i}`}
                data-i={i}
                role="option"
                aria-selected={o.value === value}
                className={"sel-opt" + (i === active ? " active" : "") + (o.value === value ? " on" : "")}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.value)}
              >
                <span className="sel-opt-text">
                  {o.label}
                  {o.hint && <small>{o.hint}</small>}
                </span>
                {o.value === value && <Icon name="check" size={15} className="sel-check" />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
