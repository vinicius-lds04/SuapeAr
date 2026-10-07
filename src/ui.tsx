import { useEffect, useRef, useState } from "react";
import type { Level } from "./data";

const PATHS: Record<string, string> = {
  dashboard: "M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0",
  history: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5 M12 7v5l4 2",
  sliders: "M21 4h-7 M10 4H3 M21 12h-9 M8 12H3 M21 20h-5 M12 20H3 M14 2v4 M8 10v4 M16 18v4",
  message: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  check: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M9 12l2 2 4-4",
  alert: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3 M12 9v4 M12 17h.01",
  octagon:
    "M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z M15 9l-6 6 M9 9l6 6",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  wind: "M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2 M9.6 4.6A2 2 0 1 1 11 8H2 M12.6 19.4A2 2 0 1 0 14 16H2",
  send: "m22 2-7 20-4-9-9-4z M22 2 11 13",
  reset: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5",
  pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z",
  arrow: "M5 12h14 M12 5l7 7-7 7",
  tick: "M20 6 9 17l-5-5",
  anchor: "M12 22V8 M5 12H2a10 10 0 0 0 20 0h-3 M15 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  close: "M18 6 6 18 M6 6l12 12",
  factory:
    "M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z M17 18h1 M12 18h1 M7 18h1",
};

export function Icon({ name, className = "size-5", fill = false }: { name: string; className?: string; fill?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export const STATUS = [
  { label: "Normal", icon: "check", soft: "bg-ok-soft text-ok-ink", solid: "bg-ok", text: "text-ok-ink", border: "border-ok/40", hex: "#1e8a4c" },
  { label: "Atenção", icon: "alert", soft: "bg-warn-soft text-warn-ink", solid: "bg-warn", text: "text-warn-ink", border: "border-warn/60", hex: "#e3a008" },
  { label: "Perigo", icon: "octagon", soft: "bg-danger-soft text-danger-ink", solid: "bg-danger", text: "text-danger-ink", border: "border-danger/50", hex: "#d23a2f" },
] as const;

export function StatusBadge({ level }: { level: Level }) {
  const s = STATUS[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${s.soft}`}>
      <Icon name={s.icon} className="size-3.5" />
      {s.label}
    </span>
  );
}

export const fmt = (v: number, d = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const hhmm = (t: number) =>
  new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const hhmmss = (t: number) =>
  new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const dayTime = (t: number) =>
  new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function LimitBar({
  value,
  warn,
  danger,
  level,
  thick = false,
}: {
  value: number;
  warn: number;
  danger: number;
  level: Level;
  thick?: boolean;
}) {
  const max = danger * 1.25;
  return (
    <div className={`relative w-full rounded-full bg-petrol-50 ${thick ? "h-2.5" : "h-1.5"}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${STATUS[level].solid}`}
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
      <span className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-warn-ink/50" style={{ left: `${(warn / max) * 100}%` }} />
      <span className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-danger-ink/60" style={{ left: `${(danger / max) * 100}%` }} />
    </div>
  );
}

type Pt = { t: number; v: number };

function niceStep(raw: number) {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
}

export function LineChart({
  points,
  warn,
  danger,
  unit,
  label,
  height = 300,
}: {
  points: Pt[];
  warn: number;
  danger: number;
  unit: string;
  label: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setW(Math.max(260, e[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  if (n < 2) return <div ref={ref} style={{ height }} className="grid place-items-center text-sm text-ink-3">Sem leituras no período.</div>;

  const ml = w < 480 ? 38 : 46;
  const mr = 12;
  const mt = 14;
  const mb = 26;
  const iw = w - ml - mr;
  const ih = height - mt - mb;
  const t0 = points[0].t;
  const t1 = points[n - 1].t;
  const maxV = points.reduce((m, p) => Math.max(m, p.v), 0);
  const rawMax = Math.max(maxV * 1.05, danger * 1.12);
  const step = niceStep(rawMax / 4);
  const yMax = Math.ceil(rawMax / step) * step;
  const X = (t: number) => ml + ((t - t0) / (t1 - t0)) * iw;
  const Y = (v: number) => mt + ih - (v / yMax) * ih;

  const line = points.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join("");
  const area = `${line}L${X(t1).toFixed(1)},${Y(0)}L${X(t0).toFixed(1)},${Y(0)}Z`;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += step) yTicks.push(v);
  const xTicks = [0, 1, 2, 3, 4].map((i) => t0 + ((t1 - t0) * i) / 4);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - rect.left) / rect.width) * (t1 - t0);
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid].t < t) lo = mid;
      else hi = mid;
    }
    setHover(Math.abs(points[lo].t - t) < Math.abs(points[hi].t - t) ? lo : hi);
  };

  const hp = hover !== null ? points[hover] : null;
  const hl: Level = hp ? (hp.v >= danger ? 2 : hp.v >= warn ? 1 : 0) : 0;
  const last = points[n - 1];
  const halo = { stroke: "#fff", strokeWidth: 3, paintOrder: "stroke" } as const;

  return (
    <div ref={ref} className="relative" style={{ height }}>
      <svg width={w} height={height} role="img" aria-label={`Gráfico de linha: ${label}`} className="block select-none">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={ml} x2={w - mr} y1={Y(v)} y2={Y(v)} stroke="#e6eef0" />
            <text x={ml - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} fill="#6b8087">
              {fmt(v, step < 1 ? 1 : 0)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={X(t)} y={height - 7} fontSize={11} fill="#6b8087" textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}>
            {hhmm(t)}
          </text>
        ))}
        <line x1={ml} x2={w - mr} y1={Y(danger)} y2={Y(danger)} stroke="#d23a2f" strokeWidth={1.5} strokeDasharray="5 4" />
        <line x1={ml} x2={w - mr} y1={Y(warn)} y2={Y(warn)} stroke="#e3a008" strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={ml + 6} y={Y(danger) - 5} fontSize={11} fontWeight={600} fill="#a0231a" {...halo}>
          Perigo · {fmt(danger, 0)}
        </text>
        <text x={ml + 6} y={Y(warn) - 5} fontSize={11} fontWeight={600} fill="#7f5600" {...halo}>
          Atenção · {fmt(warn, 0)}
        </text>
        <path d={area} fill="#2d7786" opacity={0.09} />
        <path d={line} fill="none" stroke="#1f6070" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={X(last.t)} cy={Y(last.v)} r={4.5} fill="#1f6070" stroke="#fff" strokeWidth={2} />
        {hp && (
          <g>
            <line x1={X(hp.t)} x2={X(hp.t)} y1={mt} y2={mt + ih} stroke="#1f6070" strokeOpacity={0.35} />
            <circle cx={X(hp.t)} cy={Y(hp.v)} r={5} fill={STATUS[hl].hex} stroke="#fff" strokeWidth={2} />
          </g>
        )}
        <rect x={ml} y={mt} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(X(hp.t), 70), w - 70) }}
        >
          <div className="text-ink-3">{dayTime(hp.t)}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-display text-base font-semibold text-ink">{fmt(hp.v)}</span>
            <span className="text-ink-3">{unit}</span>
          </div>
          <div className="mt-1">
            <StatusBadge level={hl} />
          </div>
        </div>
      )}
    </div>
  );
}
