import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Stats } from "../types";
import { api } from "../lib/api";
import "./dashboard.css";

/* ---------- formatlash ---------- */
const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const fmtDay = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const fmtDT = (ms: number | null | undefined) => {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${fmtDay(d)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const fmtN = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const pct = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) : 0) + "%";
const mins = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} daq ${s % 60} s` : `${s} s`);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const STATUS: Record<string, string> = { success: "Gaplashildi", aborted: "Javob yo'q", declined: "Rad etildi", accepted_elsewhere: "Boshqa joyda javob berildi", missed: "O'tkazib yuborildi", early_aborted: "Erta uzildi", declined_elsewhere: "Boshqa joyda rad etildi", unknown: "Noma'lum" };
const DIR: Record<string, string> = { out: "chiquvchi", in: "kiruvchi" };
const stageClass = (s: string) => (/^Yangi/.test(s) ? "new" : /^Qo/.test(s) ? "called" : /^Rentmi/.test(s) ? "placed" : "tenant");
const dayDate = (day: string) => new Date(day + "T00:00:00");

/* ---------- umumiy: konteyner kengligi va tooltip ---------- */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Tip = { x: number; y: number; body: ReactNode } | null;
function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const show = (e: React.MouseEvent, body: ReactNode) => {
    const r = (e.currentTarget as Element).closest(".card")!.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, body });
  };
  const hide = () => setTip(null);
  const node = tip ? <Tooltip tip={tip} /> : null;
  return { show, hide, node };
}
function Tooltip({ tip }: { tip: NonNullable<Tip> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: tip.x + 12, top: tip.y - 40 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const card = el.parentElement!.getBoundingClientRect();
    let left = tip.x + 12, top = tip.y - el.offsetHeight - 8;
    if (left + el.offsetWidth > card.width - 8) left = tip.x - el.offsetWidth - 12;
    if (top < 0) top = tip.y + 12;
    setPos({ left, top });
  }, [tip]);
  return (
    <div ref={ref} className="tip" style={pos}>
      {tip.body}
    </div>
  );
}
const TipLine = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div>
    {color && <i style={{ background: color }} />}
    {label}: {value}
  </div>
);

/* ---------- vertikal ustunlar: jami (och) + javob berilgan (to'q) ---------- */
type Col = { key: string; label: string; total: number; ok?: number; head: string; extra?: [string, string] };
function Columns({ rows }: { rows: Col[] }) {
  const [ref, cw] = useWidth<HTMLDivElement>();
  const { show, hide, node } = useTip();
  const W = Math.max(cw, 240), H = 220, m = { t: 18, r: 8, b: 28, l: 30 };
  const max = Math.max(1, ...rows.map((r) => r.total));
  // "nice" yuqori chegara: 4 ta tekis tick
  const step = Math.pow(10, Math.floor(Math.log10(max / 4))) * ([1, 2, 5, 10].find((k) => Math.pow(10, Math.floor(Math.log10(max / 4))) * k * 4 >= max) ?? 10);
  const top = Math.ceil(max / step) * step || 1;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const y = (v: number) => H - m.b - ((H - m.b - m.t) * v) / top;
  const band = (W - m.l - m.r) / Math.max(rows.length, 1);
  const bw = Math.min(band * 0.75, 32);
  const every = Math.ceil(rows.length / Math.floor((W - m.l) / 44)) || 1;
  return (
    <div ref={ref} className="chart">
      {cw > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%">
          <g className="grid">{ticks.map((t) => <line key={t} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />)}</g>
          {ticks.map((t) => <text key={t} x={m.l - 6} y={y(t) + 4} textAnchor="end">{fmtN(t)}</text>)}
          {rows.map((r, i) => {
            const x = m.l + band * i + (band - bw) / 2;
            return (
              <g key={r.key} className="hit" onMouseMove={(e) => show(e, <><div className="d">{r.head}</div><TipLine label="Jami" value={fmtN(r.total)} color="var(--d-blue-soft)" />{r.ok != null && <TipLine label="Javob berilgan" value={fmtN(r.ok)} color="var(--d-blue)" />}{r.extra && <TipLine label={r.extra[0]} value={r.extra[1]} />}</>)} onMouseLeave={hide}>
                <rect x={x} width={bw} y={y(r.total)} height={y(0) - y(r.total)} rx={4} fill="var(--d-blue-soft)" />
                {r.ok != null && <rect x={x} width={bw} y={y(r.ok)} height={y(0) - y(r.ok)} rx={4} fill="var(--d-blue)" />}
                <text className="val" x={x + bw / 2} y={y(r.total) - 5} textAnchor="middle">{fmtN(r.total)}</text>
                {i % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle">{r.label}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {node}
    </div>
  );
}

/* ---------- gorizontal ustunlar (kategoriya) ---------- */
type HRow = { key: string; label: string; value: number; color: string; extra?: [string, string] };
function HBars({ rows, minHeight = 200 }: { rows: HRow[]; minHeight?: number }) {
  const [ref, cw] = useWidth<HTMLDivElement>();
  const { show, hide, node } = useTip();
  const W = Math.max(cw, 240), rh = 32, m = { t: 4, r: 44, b: 4 }, H = m.t + rows.length * rh + m.b;
  const labelW = Math.min(W * 0.42, 200);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const x = (v: number) => ((W - labelW - m.r) * v) / max;
  return (
    <div ref={ref} className="chart" style={{ minHeight }}>
      {cw > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%">
          {rows.map((r, i) => (
            <g key={r.key} className="hit" transform={`translate(0,${m.t + i * rh})`} onMouseMove={(e) => show(e, <><div className="d">{r.label}</div><TipLine label="Soni" value={fmtN(r.value)} color={r.color} />{r.extra && <TipLine label={r.extra[0]} value={r.extra[1]} />}</>)} onMouseLeave={hide}>
              <text className="cat" x={labelW - 10} y={rh / 2 + 4} textAnchor="end">{r.label}</text>
              <rect x={labelW} y={7} height={rh - 14} width={Math.max(2, x(r.value))} rx={5} fill={r.color} />
              <text className="val" x={labelW + x(r.value) + 6} y={rh / 2 + 4}>{fmtN(r.value)}</text>
            </g>
          ))}
        </svg>
      )}
      {node}
    </div>
  );
}

/* ---------- voronka ---------- */
function Funnel({ steps }: { steps: { label: string; n: number }[] }) {
  const max = steps[0]?.n || 1;
  return (
    <div className="funnel">
      {steps.map((s, i) => {
        const w = s.n / max, wp = Math.max(w * 100, 1.5);
        const prev = i ? steps[i - 1].n : 0, lost = prev - s.n, share = prev ? 1 - s.n / prev : 0;
        return (
          <div key={s.label} className={"frow" + (i === steps.length - 1 ? " last" : "")}>
            <div className="lbl">
              {s.label}
              <small>{i ? `jamidan ${pct(s.n / max)}` : "100%"}</small>
            </div>
            <div className="track">
              <div className="bar" style={{ width: wp + "%" }} />
              <span className={"num" + (w < 0.18 ? " out" : "")} style={w < 0.18 ? { left: `calc(${wp}% + 10px)` } : undefined}>{fmtN(s.n)}</span>
            </div>
            {i > 0 && <div className={"drop" + (share >= 0.4 ? " bad" : "")}>{lost > 0 ? `−${fmtN(lost)} (${pct(share)}) oldingi bosqichdan` : "yo'qotishsiz"}</div>}
          </div>
        );
      })}
    </div>
  );
}

const Tile = ({ k, v, s, cls }: { k: string; v: string; s: string; cls?: string }) => (
  <div className={"tile" + (cls ? " " + cls : "")}>
    <span className="k">{k}</span>
    <span className="v">{v}</span>
    <span className="s">{s}</span>
  </div>
);

/* ---------- sahifa ---------- */
type SortKey = "owner" | "stage" | "calls" | "last_call_ms" | "created_ms";
type Theme = "light" | "dark" | "auto";
const THEMES: [Theme, string][] = [["light", "Yorug'"], ["dark", "Qorong'i"], ["auto", "Avto"]];
function readTheme(): Theme {
  try {
    const t = localStorage.getItem("dash-theme");
    return t === "light" || t === "dark" || t === "auto" ? t : "auto";
  } catch {
    return "auto";
  }
}

export function Dashboard() {
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_ms");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [theme, setTheme] = useState<Theme>(readTheme);
  function pickTheme(t: Theme) {
    setTheme(t);
    try {
      localStorage.setItem("dash-theme", t);
    } catch {}
  }

  const load = useCallback(async () => {
    try {
      setData(await api.stats());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [load]);
  useEffect(() => {
    document.title = "Uy egalari voronkasi";
  }, []);

  const S = data?.summary[0];
  const stages = useMemo(() => [...new Set(data?.leads.map((l) => l.stage) ?? [])], [data]);
  const leadsShown = useMemo(() => {
    if (!data) return [];
    const qq = q.trim().toLowerCase();
    const rows = data.leads.filter((d) => (!stage || d.stage === stage) && (!qq || `${d.owner} ${d.house} ${d.stage} ${d.operator}`.toLowerCase().includes(qq)));
    const numeric = sortKey === "calls" || sortKey === "last_call_ms" || sortKey === "created_ms";
    rows.sort((a, b) => {
      const r = numeric ? (Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0) : String(a[sortKey]).localeCompare(String(b[sortKey]), "uz");
      return sortDir === "asc" ? r : -r;
    });
    return rows;
  }, [data, q, stage, sortKey, sortDir]);
  const maxCalls = Math.max(1, ...(data?.leads.map((l) => l.calls) ?? [1]));

  function sortBy(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "owner" || k === "stage" ? "asc" : "desc");
    }
  }
  const Th = ({ k, children, cls }: { k: SortKey; children: ReactNode; cls?: string }) => (
    <th className={cls} aria-sort={sortKey === k ? (sortDir === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => sortBy(k)}>{children}</button>
    </th>
  );

  return (
    <div className="dash" data-theme={theme}>
      <div className="wrap">
        <div className="head">
          <div style={{ display: "grid", gap: 8 }}>
            <div className="dbrand"><i />Rentmi · Call-center <a href="/">← Doskaga</a> <a href="/logout">Chiqish</a></div>
            <h1>Uy egalari voronkasi</h1>
            {!S && <p className="lede">{error ? "Ma'lumot yuklanmadi" : "Yuklanmoqda…"}</p>}
          </div>
          <div className="theme" role="radiogroup" aria-label="Rejim">
            {THEMES.map(([t, label]) => (
              <button key={t} type="button" role="radio" aria-checked={theme === t} className={theme === t ? "on" : ""} onClick={() => pickTheme(t)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="error">{error}</div>}

        {data && S && (
          <>
            <section className="tiles" aria-label="Voronka ko'rsatkichlari">
              <Tile k="Uy egalari (jami)" v={fmtN(S.leads)} s="OLX'dan doskaga olingan" cls="accent" />
              <Tile k="Qo'ng'iroq qilingan" v={fmtN(S.leads_called)} s={`${pct(S.leads_called / S.leads)} uy egalariga`} />
              <Tile k="Gaplashilgan" v={fmtN(S.leads_talked)} s={`${pct(S.leads_talked / S.leads)} uy egalaridan, kamida bir marta javob bergan`} />
              <Tile k="Rentmi'ga joylangan" v={fmtN(S.rentmi_placed)} s={`${pct(S.rentmi_placed / S.leads)} uy egalaridan`} />
            </section>
            <section className="tiles" aria-label="Qo'ng'iroqlar">
              <Tile k="Jami qo'ng'iroqlar" v={fmtN(S.calls_total)} s={`ta qo'ng'iroq, ${fmtN(S.leads_called)} uy egasiga`} />
              <Tile k="Javob berishmadi" v={fmtN(S.leads - S.leads_talked)} s={`${pct((S.leads - S.leads_talked) / S.leads)} uy egalaridan, hech qachon javob bermagan`} />
              <Tile k="Instagram lidlari" v="Manba ulanmagan" s="Lidlar bazasi ulangach: kelgan, qo'ng'iroq qilingan, ro'yxatdan o'tgan" cls="soon" />
            </section>

            <section className="grid">
              <div className="card">
                <h2>Voronka: uy egasidan ijarachigacha</h2>
                <p className="note">Har bosqichga yetganlar soni. Qator ostida oldingi bosqichdan yo'qotish.</p>
                <Funnel steps={[{ label: "Uy egalari", n: S.leads }, { label: "Qo'ng'iroq qilingan", n: S.leads_called }, { label: "Gaplashilgan", n: S.leads_talked }, { label: "Rentmi'ga joylangan", n: S.rentmi_placed }, { label: "Ijarachi topildi", n: S.tenants }]} />
              </div>
              <div className="card">
                <h2>Hozir doskada qaysi ustunda</h2>
                <p className="note">Kartalar joriy holati bo'yicha. Yig'indisi jami uy egalariga teng.</p>
                <HBars rows={[...data.funnel].sort((a, b) => a.step - b.step).map((d) => ({ key: d.stage, label: d.stage, value: d.n, color: /^Gaplashildi/.test(d.stage) ? "var(--d-green)" : "var(--d-blue)" }))} minHeight={120} />
              </div>
            </section>

            <section className="grid">
              <div className="card">
                <h2>Kunlik qo'ng'iroqlar</h2>
                <p className="note">Ustun: jami qo'ng'iroq. To'q qism: javob berilgan.</p>
                <div className="legend"><span><i style={{ background: "var(--d-blue-soft)" }} />Jami</span><span><i style={{ background: "var(--d-blue)" }} />Javob berilgan</span></div>
                <Columns rows={data.calls_by_day.map((d) => ({ key: d.day, label: fmtDay(dayDate(d.day)), head: fmtDay(dayDate(d.day)), total: d.n, ok: d.ok, extra: ["Gaplashuv", mins(d.talk_seconds)] }))} />
              </div>
              <div className="card">
                <h2>Kunlik yangi uy egalari</h2>
                <p className="note">Doskaga qo'shilgan kartalar, kun bo'yicha.</p>
                <Columns rows={data.leads_by_day.map((d) => ({ key: d.day, label: fmtDay(dayDate(d.day)), head: fmtDay(dayDate(d.day)), total: d.n }))} />
              </div>
            </section>

            <section className="grid">
              <div className="card">
                <h2>Qo'ng'iroqlar natijasi</h2>
                <p className="note">Softphone yozuvi bo'yicha. "Javob yo'q" — ko'tarilmagan yoki bekor qilingan chiquvchi qo'ng'iroq.</p>
                <HBars rows={[...data.calls_by_status].sort((a, b) => b.n - a.n).map((d) => ({ key: `${d.status}|${d.direction}`, label: `${STATUS[d.status] ?? d.status} (${DIR[d.direction] ?? d.direction})`, value: d.n, color: d.status === "success" ? "var(--d-green)" : d.status === "declined" ? "var(--d-red)" : d.status === "aborted" ? "var(--d-orange)" : "var(--d-gray)", extra: ["Gaplashuv", mins(d.talk_seconds)] }))} />
              </div>
              <div className="card">
                <h2>Kun soatlari bo'yicha</h2>
                <p className="note">Qaysi soatda ko'proq qo'ng'iroq qilinadi va javob olinadi.</p>
                <div className="legend"><span><i style={{ background: "var(--d-blue-soft)" }} />Jami</span><span><i style={{ background: "var(--d-blue)" }} />Javob berilgan</span></div>
                <Columns rows={data.calls_by_hour.map((d) => ({ key: String(d.hour), label: hh(d.hour), head: `${hh(d.hour)} – ${hh(d.hour + 1)}`, total: d.n, ok: d.ok }))} />
              </div>
            </section>

            <section className="card">
              <h2>Operatorlar</h2>
              <p className="note">Har operatorning kartalari va qo'ng'iroqlari. Ulanish — agentidan oxirgi xabar.</p>
              <div className="tbox" style={{ maxHeight: "none" }}>
                <table>
                  <thead><tr><th>Operator</th><th className="n">Uy egalari</th><th className="n">Qo'ng'iroqlar</th><th className="n">Javob berilgan</th><th className="n">Gaplashuv</th><th>Softphone</th><th>Ulanish</th></tr></thead>
                  <tbody>
                    {data.by_operator.map((o) => (
                      <tr key={o.operator}>
                        <td>{o.operator}</td>
                        <td className="n">{fmtN(o.leads)}</td>
                        <td className="n">{fmtN(o.calls)}</td>
                        <td className="n">{o.calls ? `${fmtN(o.success)} (${pct(o.success / o.calls)})` : "0"}</td>
                        <td className="n">{mins(o.talk_seconds)}</td>
                        <td>{o.softphone === "linphone" ? "Linphone" : o.softphone === "microsip" ? "MicroSIP" : "Sozlanmagan"}</td>
                        <td>{o.last_sync_ms ? fmtDT(o.last_sync_ms) : "Hali ulanmagan"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card">
              <h2>Barcha uy egalari</h2>
              <p className="note">Doskadagi har bir karta: bosqichi, nechta qo'ng'iroq bo'lgani va oxirgi qo'ng'iroq. Sarlavhani bosib saralang.</p>
              <div className="tools">
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, uy yoki bosqich bo'yicha qidirish" aria-label="Qidirish" />
                <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Bosqich">
                  <option value="">Barcha bosqichlar</option>
                  {stages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="note">{leadsShown.length === data.leads.length ? `${fmtN(leadsShown.length)} ta karta` : `${fmtN(leadsShown.length)} / ${fmtN(data.leads.length)} ta karta`}</span>
              </div>
              <div className="tbox">
                <table>
                  <thead>
                    <tr>
                      <Th k="owner">Uy egasi</Th>
                      <Th k="stage">Bosqich</Th>
                      <Th k="calls" cls="n">Qo'ng'iroq</Th>
                      <Th k="last_call_ms" cls="hide-sm">Oxirgi qo'ng'iroq</Th>
                      <th className="hide-sm">Operator</th>
                      <Th k="created_ms" cls="hide-sm">Qo'shilgan</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadsShown.map((d) => (
                      <tr key={d.id}>
                        <td>
                          {d.olx_url ? <a href={d.olx_url} target="_blank" rel="noopener">{d.owner || "Ismsiz"}</a> : d.owner || "Ismsiz"}
                          {d.house && <span className="sub">{d.house}</span>}
                        </td>
                        <td><span className={"pill " + stageClass(d.stage)}>{d.stage}</span></td>
                        <td className="n"><i className="ibar" style={{ width: Math.round((d.calls / maxCalls) * 48) }} />{fmtN(d.calls)}</td>
                        <td className="hide-sm">{fmtDT(d.last_call_ms)}</td>
                        <td className="hide-sm">{d.operator || "—"}</td>
                        <td className="hide-sm">{fmtDT(d.created_ms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <footer>Ma'lumot har daqiqada doska bazasidan yangilanadi. Instagram lidlari manbasi ulangach shu sahifaga qo'shiladi.</footer>
          </>
        )}
      </div>
    </div>
  );
}
