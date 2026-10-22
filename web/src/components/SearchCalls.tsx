import { useState } from "react";
import type { Call } from "../types";
import { fmtPhone } from "../lib/text";
import { CallLine } from "./CallRow";

export type UnknownNumber = { phoneKey: string; number: string; calls: Call[] };

type Props = { items: UnknownNumber[]; me: string; onCreate: (number: string) => void };

/** Qidiruvda: doskada kartasi yo'q, lekin qo'ng'iroq bo'lgan raqamlar. */
export function SearchCalls({ items, me, onCreate }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  if (!items.length) return null;

  return (
    <section className="search-calls" aria-label="Doskada yo'q raqamlar">
      <div className="sc-title">
        Doskada yo'q, lekin qo'ng'iroq bo'lgan: <b>{items.length}</b> ta raqam
      </div>
      <ul>
        {items.map((it) => (
          <li key={it.phoneKey}>
            <div className="sc-row">
              <span className="phone">{fmtPhone(it.number)}</span>
              <button type="button" className="stat-link" onClick={() => setOpen(open === it.phoneKey ? null : it.phoneKey)} aria-expanded={open === it.phoneKey}>
                {it.calls.length} ta qo'ng'iroq
              </button>
              <CallLine call={it.calls[0]} me={me} />
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => onCreate(it.number)}>
                + Karta yaratish
              </button>
            </div>
            {open === it.phoneKey && (
              <ul className="call-list compact">
                {it.calls.map((c) => (
                  <li key={c.id}>
                    <CallLine call={c} me={me} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
