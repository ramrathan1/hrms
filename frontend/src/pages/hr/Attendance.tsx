import clsx from "clsx";
import { Check, Clock, Download, LogIn, LogOut, MapPin, Plane, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormModal } from "@/components/crud";
import { PageHeader, FilterBar } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { AttendanceLegend, MONTH_NAMES, YEARS, stateOf } from "@/components/AttendanceCalendar";
import { AvatarName, Select, StatusPill, Tabs } from "@/components/ui";
import { employees } from "@/data/core";
import { daysInMonth, shifts } from "@/data/hr";
import {
  attendanceToday, can, clockIn as apiClockIn, clockOut as apiClockOut, loadAttendanceGrid,
  markAttendance, type AttendanceGrid,
} from "@/lib/api";
import { useToast } from "@/lib/store";
import { todayISO } from "@/lib/format";

const MONTHS = MONTH_NAMES;

export default function Attendance() {
  const { push } = useToast();
  const [tab, setTab] = useState("Monthly grid");
  const [dept, setDept] = useState("All");
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const monthIdx = MONTHS.indexOf(month);
  const yearNum = Number(year);
  const days = Array.from({ length: daysInMonth(monthIdx, yearNum) }, (_, i) => i + 1);
  const [clockedIn, setClockedIn] = useState(false);
  const [inAt, setInAt] = useState<string | null>(null);
  const [outAt, setOutAt] = useState<string | null>(null);
  const [onLeaveToday, setOnLeaveToday] = useState<{ on: boolean; label: string | null }>({
    on: false,
    label: null,
  });
  const [markOpen, setMarkOpen] = useState(false);
  const [grid, setGrid] = useState<AttendanceGrid | null>(null);
  const [loading, setLoading] = useState(true);
  // Undefined until the organisation has configured a shift; the badge hides.
  const myShift = shifts[0] as { name: string; start: string; end: string } | undefined;

  /* Whether I'm clocked in is the server's answer, not this tab's memory —
     otherwise clocking in on a phone leaves the desktop offering "Clock In". */
  const refreshToday = () =>
    attendanceToday().then((t) => {
      setClockedIn(t.clockedIn);
      setInAt(t.in);
      setOutAt(t.out);
      setOnLeaveToday({ on: t.onLeave, label: t.leaveLabel });
    });

  useEffect(() => {
    void refreshToday();
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void loadAttendanceGrid(monthIdx + 1, yearNum).then((g) => {
      if (!live) return;
      setGrid(g);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [monthIdx, yearNum]);

  /* One row per employee the grid came back with, in the chosen department.
     Driving this from the local employee list instead meant the grid listed
     every colleague even when the server had scoped the data to one person —
     rows of empty cells under other people's names. */
  const byEmployee = new Map((grid?.rows ?? []).map((r) => [r.employeeId, r]));
  const rows = employees
    .filter((e) => byEmployee.has(e.id))
    .filter((e) => dept === "All" || e.department === dept)
    .map((e) => ({ ...e, att: byEmployee.get(e.id)?.days ?? [] }));

  /* Clocking in changes today's cell in the grid too, so re-read both. */
  const refreshGrid = async () => setGrid(await loadAttendanceGrid(monthIdx + 1, yearNum));

  const clockIn = async () => {
    try {
      await apiClockIn();
      await Promise.all([refreshToday(), refreshGrid()]);
      push("Clocked in");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't clock in");
    }
  };
  const clockOut = async () => {
    try {
      await apiClockOut();
      await Promise.all([refreshToday(), refreshGrid()]);
      push("Clocked out — have a good evening");
    } catch (err) {
      push(err instanceof Error ? err.message : "Couldn't clock out");
    }
  };

  const count = (code: number) =>
    rows.reduce((a, r) => a + r.att.filter((x) => x === code).length, 0);
  const present = count(1) + count(3);
  const absent = count(0);
  const late = count(3);
  const onLeave = count(4);

  return (
    <>
      <PageHeader
        title="Attendance"
        crumbs={["HR"]}
        actions={
          <>
            {/* Correcting someone else's record is an HR action the server
                gates on attendance:update. Without this check the control was
                offered to everyone and answered with a 403 nobody saw. */}
            {can("attendance:update") && (
              <button className="btn-outline" onClick={() => setMarkOpen(true)}>
                Mark attendance
              </button>
            )}
            <button
              className="btn-outline"
              onClick={() => {
                const csv = ["Employee,Present,Absent,Late", ...rows.map((e) => {
                  const a = e.att;
                  return [e.name, a.filter((x) => x === 1 || x === 3).length, a.filter((x) => x === 0).length, a.filter((x) => x === 3).length].join(",");
                })].join("\n");
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                a.download = `attendance-${month}-${year}.csv`;
                a.click();
                push(`attendance-${month}-${year}.csv downloaded`);
              }}
            >
              <Download size={15} /> Export
            </button>
          </>
        }
      />

      {/* my attendance today */}
      <div className="card mb-5 flex flex-wrap items-center gap-5 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className={clsx("flex h-11 w-11 items-center justify-center rounded-xl", clockedIn ? "bg-good-soft text-good" : "bg-page text-muted")}>
            {clockedIn ? <LogIn size={20} /> : <LogOut size={20} />}
          </span>
          <div>
            <p className="font-display text-[15px] font-bold">My attendance · Today</p>
            <p className="text-sm text-muted">
              {onLeaveToday.on && !inAt
                ? `On approved ${(onLeaveToday.label ?? "leave").toLowerCase()} leave today`
                : inAt
                  ? `Clocked in ${inAt}`
                  : "Not clocked in yet"}
              {outAt ? ` · Clocked out ${outAt}` : clockedIn ? " · Working now" : ""}
            </p>
          </div>
        </div>
        {/* Named from the configured shift. It used to read "Worksuite HQ ·
            General Shift 09:00–18:00" whether or not a single shift existed,
            which is a working day the employee never agreed to. */}
        {myShift && (
          <span className="flex items-center gap-1.5 rounded-full bg-page px-3 py-1.5 text-xs text-muted">
            <MapPin size={12} /> {myShift.name} {myShift.start}–{myShift.end}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {/* Once the day is closed there is nothing left to press. The button
              used to flip back to "Clock In", which sent a second request the
              server answered with 409 and the page never mentioned. */}
          {outAt ? (
            <span className="rounded-lg bg-page px-4 py-2 text-sm font-semibold text-muted">Day complete</span>
          ) : onLeaveToday.on && !clockedIn ? (
            /* A day off is not a day to clock in on. The button used to be live
               and the server answered the press with a refusal. */
            <span className="flex items-center gap-2 rounded-lg bg-warn-soft px-4 py-2 text-sm font-semibold text-[#a9720e]">
              <Plane size={15} /> On leave today
            </span>
          ) : !clockedIn ? (
            <button className="btn-primary" onClick={clockIn}>
              <LogIn size={15} /> Clock In
            </button>
          ) : (
            <button className="btn bg-bad px-4 py-2 font-semibold text-white hover:brightness-110" onClick={clockOut}>
              <LogOut size={15} /> Clock Out
            </button>
          )}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Present days" value={present} icon={Check} sub={can("attendance:update") ? "this month, all staff" : "this month"} />
        <StatCard label="Absent days" value={absent} icon={X} />
        <StatCard label="Late arrivals" value={late} icon={Clock} />
        <StatCard label="On leave" value={onLeave} icon={Plane} />
      </div>

      <div className="card mb-5 px-2">
        <Tabs tabs={["Monthly grid", "By member"]} active={tab} onChange={setTab} className="border-b-0" />
      </div>

      <FilterBar>
        <Select label="Month" value={month} onChange={setMonth} options={MONTHS} />
        <Select label="Year" value={year} onChange={setYear} options={YEARS} />
        <Select label="Department" value={dept} onChange={setDept} options={["All", "Engineering", "Design", "Delivery", "Human Resource"]} />
        <AttendanceLegend className="ml-auto" />
      </FilterBar>

      {loading ? (
        <div className="card py-16 text-center text-sm text-faint">Loading attendance…</div>
      ) : tab === "Monthly grid" ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 border-b border-line bg-[#f6f6fb] px-4 py-2.5 text-left font-semibold text-muted">Employee</th>
                {days.map((d) => (
                  <th key={d} className="border-b border-line px-1 py-2.5 text-center font-medium text-faint tabular-nums">{d}</th>
                ))}
                <th className="border-b border-line px-3 py-2.5 text-right font-semibold text-muted">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const att = e.att;
                return (
                  <tr key={e.id} className="hover:bg-page/60">
                    <td className="sticky left-0 border-b border-line bg-white px-4 py-2 whitespace-nowrap">
                      <AvatarName name={e.name} sub={e.designation} size={26} />
                    </td>
                    {att.map((s, i) => (
                      <td key={i} className="border-b border-line px-1 py-2 text-center" title={`${month.slice(0, 3)} ${i + 1}, ${year} · ${stateOf(s).label}`}>
                        {(() => {
                          const st = stateOf(s);
                          return <st.icon size={13} className={`mx-auto ${st.ink}`} />;
                        })()}
                      </td>
                    ))}
                    <td className="border-b border-line px-3 py-2 text-right font-semibold tabular-nums">
                      {att.filter((s) => s === 1 || s === 3).length} / {att.filter((s) => s !== 2 && s !== 5).length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl w-full text-sm">
            <thead>
              <tr><th>Employee</th><th>Present</th><th>Absent</th><th>Late</th><th>On leave</th><th>Attendance %</th></tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const a = e.att;
                // Weekends and days still to come aren't working days, and
                // dividing by zero would print NaN% on a fresh month.
                const working = a.filter((s) => s !== 2 && s !== 5).length;
                const p = a.filter((s) => s === 1 || s === 3).length;
                const pct = working ? Math.round((p / working) * 100) : 0;
                return (
                  <tr key={e.id}>
                    <td><AvatarName name={e.name} sub={e.designation} size={28} /></td>
                    <td className="tabular-nums">{p}</td>
                    <td className="tabular-nums">{a.filter((s) => s === 0).length}</td>
                    <td className="tabular-nums">{a.filter((s) => s === 3).length}</td>
                    <td className="tabular-nums">{a.filter((s) => s === 4).length}</td>
                    <td>
                      <StatusPill status={`${pct}%`} tone={pct >= 90 ? "good" : pct >= 75 ? "warn" : "bad"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <FormModal
        open={markOpen}
        title="Mark attendance manually"
        fields={[
          { key: "employee", label: "Employee", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })), required: true },
          { key: "date", label: "Date", type: "date", required: true },
          { key: "status", label: "Status", type: "select", options: ["Present", "Absent", "Late", "Half day", "On leave"] },
          { key: "in", label: "Clock in", placeholder: "09:00 AM" },
          { key: "out", label: "Clock out", placeholder: "06:00 PM" },
          { key: "note", label: "Note", type: "textarea" },
        ]}
        initial={{ date: todayISO(), status: "Present", in: "09:00 AM", out: "06:00 PM" }}
        submitLabel="Save attendance"
        onSubmit={async (v) => {
          const who = employees.find((e) => e.id === v.employee)?.name ?? "employee";
          setMarkOpen(false);
          try {
            await markAttendance({
              employeeId: String(v.employee),
              workDate: String(v.date),
              status: String(v.status),
              clockInAt: v.in ? String(v.in) : undefined,
              clockOutAt: v.out ? String(v.out) : undefined,
              note: v.note ? String(v.note) : undefined,
            });
            // Re-read so the grid shows the correction immediately.
            await refreshGrid();
            push(`Attendance saved for ${who}`);
          } catch (err) {
            push(err instanceof Error ? err.message : "Couldn't save attendance");
          }
        }}
        onClose={() => setMarkOpen(false)}
      />
    </>
  );
}
