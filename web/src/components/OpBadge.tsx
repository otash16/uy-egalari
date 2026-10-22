import { opColor } from "../lib/operators";

/** Operator nomi — rangli kichik belgi. */
export function OpBadge({ name, me, title }: { name: string; me?: string; title?: string }) {
  if (!name) return null;
  return (
    <span className={"op" + (me && me === name ? " me" : "")} style={{ "--op": opColor(name) } as React.CSSProperties} title={title ?? `Mas'ul: ${name}`}>
      {name}
    </span>
  );
}
