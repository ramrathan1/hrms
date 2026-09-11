import { useMemo } from "react";

const PALETTE = ["#5b5ceb", "#1fa971", "#e8983c", "#e85d51", "#5b5ceb", "#4cc3ff", "#f5679e", "#8b94a7"];

export function LineChart({
  points,
  labels,
  height = 220,
  color = "#5b5ceb",
  yFmt = (v: number) => String(v),
}: {
  points: number[];
  labels: string[];
  height?: number;
  color?: string;
  yFmt?: (v: number) => string;
}) {
  const w = 720;
  const pad = { l: 48, r: 16, t: 14, b: 26 };
  const max = Math.max(...points, 1) * 1.15;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(points.length - 1, 1);
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p)}`).join(" ");
  const area = `${path} L${x(points.length - 1)},${height - pad.b} L${x(0)},${height - pad.b} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#e9e5f7" />
          <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#8b94a7">
            {yFmt(Math.round(t))}
          </text>
        </g>
      ))}
      <path d={area} fill={color} opacity="0.09" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p)} r="3.2" fill="#fff" stroke={color} strokeWidth="2" />
      ))}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#8b94a7">
          {l}
        </text>
      ))}
    </svg>
  );
}

export function BarChart({
  data,
  height = 220,
  yFmt = (v: number) => String(v),
}: {
  data: { label: string; values: { name: string; value: number; color?: string }[] }[];
  height?: number;
  yFmt?: (v: number) => string;
}) {
  const w = 720;
  const pad = { l: 52, r: 12, t: 14, b: 26 };
  const max = Math.max(...data.flatMap((d) => d.values.map((v) => v.value)), 1) * 1.15;
  const groupW = (w - pad.l - pad.r) / data.length;
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#e9e5f7" />
          <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#8b94a7">
            {yFmt(Math.round(t))}
          </text>
        </g>
      ))}
      {data.map((d, gi) => {
        const n = d.values.length;
        const bw = Math.min(26, (groupW * 0.6) / n);
        const start = pad.l + gi * groupW + (groupW - bw * n - 4 * (n - 1)) / 2;
        return (
          <g key={gi}>
            {d.values.map((v, vi) => (
              <rect
                key={vi}
                x={start + vi * (bw + 4)}
                y={y(v.value)}
                width={bw}
                height={height - pad.b - y(v.value)}
                rx="3"
                fill={v.color ?? PALETTE[vi % PALETTE.length]}
              />
            ))}
            <text x={pad.l + gi * groupW + groupW / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="#8b94a7">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({
  segments,
  size = 190,
  centerLabel,
}: {
  segments: { label: string; value: number; color?: string }[];
  size?: number;
  centerLabel?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 62;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const segs = segments.map((s, i) => {
    const frac = s.value / total;
    const el = { ...s, color: s.color ?? PALETTE[i % PALETTE.length], off: acc * c, len: frac * c };
    acc += frac;
    return el;
  });
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#e9e5f7" strokeWidth="20" />
        {segs.map((s, i) => (
          <circle
            key={i}
            cx="80"
            cy="80"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="20"
            strokeDasharray={`${s.len} ${c - s.len}`}
            strokeDashoffset={-s.off + c / 4}
          />
        ))}
        <text x="80" y="76" textAnchor="middle" fontSize="20" fontWeight="700" fill="#1c2230">
          {total}
        </text>
        {centerLabel && (
          <text x="80" y="94" textAnchor="middle" fontSize="10" fill="#8b94a7">
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {segs.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="ml-auto pl-4 font-semibold tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function useSeries(seed: number, n: number, min: number, max: number) {
  return useMemo(() => {
    let s = seed;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    return Array.from({ length: n }, () => Math.round(min + rnd() * (max - min)));
  }, [seed, n, min, max]);
}
