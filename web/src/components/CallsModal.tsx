import { useMemo, useState } from "react";
import type { Call, Lead } from "../types";
import { isTalked, isToday } from "../lib/calls";
import { fmtPhone } from "../lib/text";
import { CallLine } from "./CallRow";
import { Modal } from "./Modal";

type Tab = "today" | "mine" | "all" | "unknown";

type Props = {
  calls: Call[];
  leads: Lead[];
  me: string;
  /** Oddiy operator uchun oyna "Meniki" tabidan ochiladi, dasturchi uchun "Bugun" */
  defaultTab?: Tab;
  onClose: () => void;
  onOpenLead: (lead: Lead) => void;
  onCreateFrom: (number: string) => void;
};

/** Hamma operatorlarning softphone'laridan olingan qo'ng'iroqlar; doskada yo'q raqamlardan karta yaratish mumkin. */
export function CallsModal({ calls, leads, me, defaultTab = "today", onClose, onOpenLead, onCreateFrom }: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  const leadByKey = useMemo(() => {
    const m = new Map<string, Lead>();
    for (const l of leads) if (l.phoneKey) m.set(l.phoneKey, l);
    return m;
  }, [leads]);

  const today = calls.filter((c) => isToday(c.startedAt));
  const unknown = calls.filter((c) => !leadByKey.has(c.phoneKey));
  const mine = calls.filter((c) => c.operator === me);
  const list = tab === "today" ? today : tab === "mine" ? mine : tab === "unknown" ? unknown : calls;

  const tabs: [Tab, string, number][] = [
    ["today", "Bugun", today.length],
    ["mine", "Meniki", mine.length],
    ["all", "Hammasi", calls.length],
    ["unknown", "Doskada yo'q", unknown.length],
  ];

  return (
    <Modal title="Qo'ng'iroqlar" onClose={onClose} wide>
      <div className="calls-body">
        <div className="tabs" role="tablist">
          {tabs.map(([key, label, n]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>
              {label} <span className="n">{n}</span>
            </button>
          ))}
        </div>
        {tab === "today" && today.length > 0 && (
          <div className="hint">
            Bugun {today.filter((c) => c.direction === "out").length} ta chiquvchi, {today.filter(isTalked).length} tasida gaplashildi
          </div>
        )}
        <ul className="call-list">
          {list.map((c) => {
            const lead = leadByKey.get(c.phoneKey);
            return (
              <li key={c.id}>
                <div className="who">
                  {lead ? (
                    <button type="button" className="link" onClick={() => onOpenLead(lead)}>
                      {lead.ownerName || "Ismsiz"}
                    </button>
                  ) : (
                    <span className="unknown">Doskada yo'q</span>
                  )}
                  <span className="phone">{fmtPhone(c.number)}</span>
                  {!lead && (
                    <button type="button" className="copy" onClick={() => onCreateFrom(c.number)}>
                      + Karta
                    </button>
                  )}
                </div>
                <CallLine call={c} me={me} />
              </li>
            );
          })}
          {!list.length && <li className="empty-row">Qo'ng'iroq yo'q</li>}
        </ul>
      </div>
    </Modal>
  );
}
