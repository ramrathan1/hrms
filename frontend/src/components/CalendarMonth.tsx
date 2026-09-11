import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { TODAY, iso, monthName } from "@/lib/format";

export type CalEvent = { date: string; title: string; color?: string };

export function CalendarMonth({
  events,
  compact,
  onDayClick,
}: {
  events: CalEvent[];
  compact?: boolean;
  /** clicking an empty day calls this with the ISO date — used to create events */
  onDayClick?: (date: string) => void;
}) {
  const [cursor, setCursor] = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const [view, setView] = useState("month");
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = first.getDay(); // Sunday start
  const cells: Date[] = [];
  const start = new Date(first);
  start.setDate(1 - startOffset);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  const byDate = new Map<string, CalEvent[]>();
  events.forEach((e) => {
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  });
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <button className="btn-outline px-2.5 py-1.5" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month">
            <ChevronLeft size={15} />
          </button>
          <button className="btn-outline px-2.5 py-1.5" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month">
            <ChevronRight size={15} />
          </button>
          <button className="btn-outline px-3 py-1.5" onClick={() => setCursor(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))}>
            today
          </button>
        </div>
        <h3 className="text-[15px] font-semibold">
          {monthName(cursor.getMonth())} {cursor.getFullYear()}
        </h3>
        <div className="flex overflow-hidden rounded-md border border-line text-sm">
          {["month", "week", "day", "list"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={clsx("cursor-pointer px-3 py-1.5 capitalize", v === view ? "bg-ink text-white" : "bg-white text-muted hover:bg-page")}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {view === "list" ? (
        <ul className="divide-y divide-line">
          {events
            .filter((e) => e.date.startsWith(iso(cursor).slice(0, 7)))
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((e, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color ?? "#5b5ceb" }} />
                <span className="w-28 text-muted tabular-nums">{e.date}</span>
                <span className="font-medium">{e.title}</span>
              </li>
            ))}
          {events.filter((e) => e.date.startsWith(iso(cursor).slice(0, 7))).length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-faint">No events this month</li>
          )}
        </ul>
      ) : (
        <div className="grid grid-cols-7">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="border-b border-line px-2 py-2 text-center text-xs font-semibold text-muted">
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === cursor.getMonth();
            const key = iso(d);
            const evs = byDate.get(key) ?? [];
            const isToday = key === iso(TODAY);
            return (
              <div
                key={i}
                onClick={() => onDayClick?.(key)}
                className={clsx(
                  "group relative border-r border-b border-line/70 p-1.5",
                  compact ? "min-h-16" : "min-h-24",
                  !inMonth && "bg-page/60",
                  isToday && "bg-primary-soft",
                  onDayClick && "cursor-pointer hover:bg-primary-soft/60"
                )}
              >
                {onDayClick && (
                  <span className="pointer-events-none absolute top-1.5 left-1.5 hidden text-[11px] font-bold text-primary group-hover:block">
                    + Add
                  </span>
                )}
                <div className={clsx("mb-1 text-right text-xs tabular-nums", inMonth ? "text-muted" : "text-faint", isToday && "font-bold text-primary")}>
                  {d.getDate()}
                </div>
                <div className="flex flex-col gap-1">
                  {evs.slice(0, compact ? 1 : 3).map((e, j) => (
                    <div
                      key={j}
                      className="truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                      style={{ background: e.color ?? "#5b5ceb" }}
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  ))}
                  {evs.length > (compact ? 1 : 3) && (
                    <span className="text-[11px] font-medium text-primary">+{evs.length - (compact ? 1 : 3)} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
