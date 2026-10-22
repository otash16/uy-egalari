import type { Call } from "../types";
import { callLabel, fmtCallTime, fmtDuration, isTalked } from "../lib/calls";
import { OpBadge } from "./OpBadge";

/** Qo'ng'iroq yo'nalishi, vaqti, natijasi va davomiyligi — bitta qator. Kim qilgani ham ko'rinadi. */
export function CallLine({ call: c, me }: { call: Call; me?: string }) {
  return (
    <span className="call-line">
      {c.operator && <OpBadge name={c.operator} me={me} title={`${c.operator} qo'ng'iroq qilgan`} />}
      <span className={"dir " + c.direction} title={c.direction === "out" ? "Chiquvchi" : "Kiruvchi"}>
        {c.direction === "out" ? "↗" : "↙"}
      </span>
      <span className="when">{fmtCallTime(c.startedAt)}</span>
      <span className={isTalked(c) ? "res ok" : "res no"}>{callLabel(c)}</span>
      {c.duration > 0 && <span className="dur">{fmtDuration(c.duration)}</span>}
    </span>
  );
}
