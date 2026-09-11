/* One person's attendance, month by month.
   Two things the flat day-strip got wrong: you could only ever see the current
   month, and status was carried by colour alone. This lays the days out on a
   real weekday grid, lets you walk backwards through months and years, and
   gives every state its own icon so it still reads if the colours don't. */
import { ChevronLeft, ChevronRight, Check, Clock, CircleDashed, Minus, Plane, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadAttendanceGrid } from "@/lib/api";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Earliest and latest month the arrows will walk to. */
const FIRST_YEAR = 2024;
/* Walks with the calendar rather than stopping at a year hardcoded when this
   was written. */
const LAST_YEAR = new Date().getFullYear();
export const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => String(LAST_YEAR - i));

export type AttendanceState = {
  code: number;
  label: string;
  icon: LucideIcon;
  /** calendar cell fill */
  cell: string;
  /** icon + legend swatch colour */
  ink: string;
  /** counts toward the attendance percentage */
  working: boolean;
};

/* Codes as the API reports them: 0 absent · 1 present · 2 weekend or holiday ·
   3 late · 4 on leave · 5 still to come.
   Present and Late used to differ only by colour — Late has its own icon now. */
export const ATTENDANCE_STATES: AttendanceState[] = [
  { code: 1, label: "Present", icon: Check, cell: "bg-good-soft text-good", ink: "text-good", working: true },
  { code: 3, label: "Late", icon: Clock, cell: "bg-warn-soft text-[#a9720e]", ink: "text-[#a9720e]", working: true },
  { code: 0, label: "Absent", icon: X, cell: "bg-bad-soft text-bad", ink: "text-bad", working: true },
  { code: 4, label: "On leave", icon: Plane, cell: "bg-info-soft text-info", ink: "text-info", working: true },
  { code: 2, label: "Weekend", icon: Minus, cell: "bg-page text-faint", ink: "text-faint", working: false },
  { code: 5, label: "Upcoming", icon: CircleDashed, cell: "bg-page/60 text-faint", ink: "text-faint", working: false },
];

export const stateOf = (code: number) =>
  ATTENDANCE_STATES.find((s) => s.code === code) ?? ATTENDANCE_STATES[4];

/** Icon + label pairs, shown under any grid that uses the colours above. */
export function AttendanceLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted ${className}`}>
      {ATTENDANCE_STATES.map((s) => (
        <span key={s.code} className="flex items-center gap-1.5">
          <span className={`flex h-5 w-5 items-center justify-center rounded ${s.cell}`}>
            <s.icon size={12} />
          </span>
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function AttendanceCalendar({
  employeeId,
  initialMonth = new Date().getMonth(),
  initialYear = new Date().getFullYear(),
}: {
  /** Whose attendance to show. */
  employeeId: string;
  initialMonth?: number;
  initialYear?: number;
}) {
  /* One piece of state, so stepping is atomic — two quick clicks on the arrow
     both land instead of the second recomputing from a stale month. */
  const [{ month, year }, setCursor] = useState({ month: initialMonth, year: initialYear });
  const setMonth = (m: number) => setCursor((c) => ({ ...c, month: m }));
  const setYear = (y: number) => setCursor((c) => ({ ...c, year: y }));

  const step = (delta: number) =>
    setCursor((c) => {
      const total = c.year * 12 + c.month + delta;
      const y = Math.floor(total / 12);
      if (y < FIRST_YEAR || y > LAST_YEAR) return c;
      return { year: y, month: total - y * 12 };
    });
  const atStart = year === FIRST_YEAR && month === 0;
  const atEnd = year === LAST_YEAR && month === 11;

  const [days, setDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  /* One request per month on screen. Walking back through the year is a series
     of small fetches rather than one enormous one. */
  useEffect(() => {
    let live = true;
    setLoading(true);
    void loadAttendanceGrid(month + 1, year).then((grid) => {
      if (!live) return;
      const row = grid?.rows.find((r) => r.employeeId === employeeId);
      setDays(row?.days ?? []);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [employeeId, month, year]);

  const leading = new Date(year, month, 1).getDay();
  const counts = ATTENDANCE_STATES.map((s) => ({
    ...s,
    n: days.filter((d) => d === s.code).length,
  }));
  const working = counts.filter((c) => c.working).reduce((a, c) => a + c.n, 0);
  const attended = counts.filter((c) => c.code === 1 || c.code === 3).reduce((a, c) => a + c.n, 0);
  const pct = working ? Math.round((attended / working) * 100) : 0;

  return (
    <div className="card p-5">
      {/* month navigation */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost cursor-pointer px-1.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-35"
            onClick={() => step(-1)}
            disabled={atStart}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="btn-ghost cursor-pointer px-1.5 py-1.5 disabled:cursor-not-allowed disabled:opacity-35"
            onClick={() => step(1)}
            disabled={atEnd}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <select
          className="input w-auto py-1.5 text-sm font-semibold"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          aria-label="Month"
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i}>{m}</option>
          ))}
        </select>
        <select
          className="input w-auto py-1.5 text-sm font-semibold"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          aria-label="Year"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <span className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted">
            <span className="font-bold text-primary tabular-nums">{pct}%</span> attendance
          </span>
          <Link to="/hr/attendance" className="text-sm font-semibold text-primary hover:underline">
            Everyone →
          </Link>
        </span>
      </div>

      {/* per-state totals for the month on screen */}
      <div className="mb-4 flex flex-wrap gap-2">
        {counts.map((c) => (
          <span key={c.code} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${c.cell}`}>
            <c.icon size={12} />
            {c.n} {c.label.toLowerCase()}
          </span>
        ))}
      </div>

      {/* weekday grid */}
      {!loading && days.length === 0 && (
        <p className="py-10 text-center text-sm text-faint">
          No attendance recorded for {MONTH_NAMES[month]} {year}.
        </p>
      )}
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] font-bold tracking-wide text-faint uppercase">
            {w}
          </div>
        ))}
        {Array.from({ length: leading }, (_, i) => <div key={`pad-${i}`} />)}
        {days.map((code, i) => {
          const s = stateOf(code);
          const date = `${MONTH_NAMES[month].slice(0, 3)} ${i + 1}, ${year}`;
          return (
            <div
              key={i}
              title={`${date} · ${s.label}`}
              className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg ${s.cell}`}
            >
              <span className="text-xs font-semibold tabular-nums">{i + 1}</span>
              <s.icon size={13} />
              <span className="sr-only">{s.label}</span>
            </div>
          );
        })}
      </div>

      <AttendanceLegend className="mt-4 border-t border-line pt-4" />
      <p className="mt-3 text-xs text-faint">
        {attended} of {working} working days attended in {MONTH_NAMES[month]} {year} · weekends excluded
      </p>
    </div>
  );
}
