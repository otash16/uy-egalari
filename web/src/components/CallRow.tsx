import type { Call } from "../types";
import { callLabel, fmtCallTime, fmtDuration, isTalked } from "../lib/calls";

/** Qo'ng'iroq yo'nalishi, vaqti, natijasi va davomiyligi — bitta qator. */
export function CallLine({ call: c }: { call: Call }) {
  return (
    <span className="call-line">
      <span className={"dir " + c.direction} title={c.direction === "out" ? "Chiquvchi" : "Kiruvchi"}>
        {c.direction === "out" ? "↗" : "↙"}
      </span>
      <span className="when">{fmtCallTime(c.startedAt)}</span>
      <span className={isTalked(c) ? "res ok" : "res no"}>{callLabel(c)}</span>
      {c.duration > 0 && <span className="dur">{fmtDuration(c.duration)}</span>}
    </span>
  );
}
