import { useRef, useState } from "react";

const STATUS_COLOR: Record<string, string> = {
  Completed: "#16a066",
  Doing: "#3f9af5",
  "To Do": "#e8983c",
  Incomplete: "#e5554a",
};

export type GanttRow = { id?: string; label: string; start: string; end: string; status: string };

const dayMs = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function Gantt({
  rows,
  from,
  to,
  onReschedule,
}: {
  rows: GanttRow[];
  from: string;
  to: string;
  /** drag a bar to shift its dates — receives the row id and its new start/end */
  onReschedule?: (id: string, start: string, end: string) => void;
}) {
  const t0 = new Date(from + "T00:00:00").getTime();
  const t1 = new Date(to + "T00:00:00").getTime();
  const span = t1 - t0 || 1;
  const w = 760;
  const labelW = 190;
  const rowH = 34;
  const trackW = w - labelW - 10;
  const h = rows.length * rowH + 34;

  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; startX: number; offsetDays: number } | null>(null);

  const x = (d: string) =>
    labelW + Math.min(Math.max(((new Date(d + "T00:00:00").getTime() - t0) / span) * trackW, 0), trackW);

  const months: { x: number; label: string }[] = [];
  const cur = new Date(t0);
  cur.setDate(1);
  while (cur.getTime() <= t1) {
    months.push({ x: x(iso(cur)), label: cur.toLocaleDateString("en-US", { month: "short" }) });
    cur.setMonth(cur.getMonth() + 1);
  }

  /** convert a pixel delta on screen into whole days */
  const pxToDays = (px: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    const scale = rect ? rect.width / w : 1;
    return Math.round((px / scale / trackW) * (span / dayMs));
  };

  const onMove = (e: React.MouseEvent) => {
    if (!drag) return;
    setDrag({ ...drag, offsetDays: pxToDays(e.clientX - drag.startX) });
  };

  const onUp = () => {
    if (drag && drag.offsetDays !== 0 && onReschedule) {
      const row = rows.find((r) => (r.id ?? r.label) === drag.id);
      if (row) {
        const shift = drag.offsetDays * dayMs;
        onReschedule(
          drag.id,
          iso(new Date(new Date(row.start + "T00:00:00").getTime() + shift)),
          iso(new Date(new Date(row.end + "T00:00:00").getTime() + shift))
        );
      }
    }
    setDrag(null);
  };

  return (
    <div className="overflow-x-auto">
      {onReschedule && (
        <p className="mb-2 text-xs text-faint">Drag a bar sideways to reschedule the task.</p>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="w-full min-w-[640px] select-none"
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      >
        {months.map((m, i) => (
          <g key={i}>
            <line x1={m.x} x2={m.x} y1={22} y2={h} stroke="#e9e5f7" />
            <text x={m.x + 4} y={14} fontSize="10" fill="#9a9bae">{m.label}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const id = r.id ?? r.label;
          const y = 30 + i * rowH;
          const dragging = drag?.id === id;
          const shiftPx = dragging ? (drag!.offsetDays * dayMs * trackW) / span : 0;
          const bx = x(r.start) + shiftPx;
          const bw = Math.max(x(r.end) - x(r.start), 6);
          return (
            <g key={id}>
              <text x={0} y={y + 15} fontSize="11" fill="#1d1e2c" fontWeight="500">
                {r.label.length > 28 ? r.label.slice(0, 28) + "…" : r.label}
              </text>
              <rect x={labelW} y={y + 4} width={trackW} height={18} rx="4" fill="#f3f3f9" />
              <rect
                x={bx}
                y={y + 4}
                width={bw}
                height={18}
                rx="4"
                fill={STATUS_COLOR[r.status] ?? "#9a9bae"}
                opacity={dragging ? 1 : 0.9}
                style={{ cursor: onReschedule ? "grab" : "default" }}
                onMouseDown={(e) => onReschedule && setDrag({ id, startX: e.clientX, offsetDays: 0 })}
              />
              {dragging && drag!.offsetDays !== 0 && (
                <text x={bx + bw + 6} y={y + 17} fontSize="10" fontWeight="700" fill="#5b5ceb">
                  {drag!.offsetDays > 0 ? "+" : ""}{drag!.offsetDays}d
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
