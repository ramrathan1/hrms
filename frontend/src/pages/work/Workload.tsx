/* Team workload & capacity — who is over-allocated, who has room, and what
   each person is carrying this week. Capacity = 40h/week minus approved leave. */
import clsx from "clsx";
import { AlertTriangle, CalendarOff, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, FilterBar } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Avatar, AvatarName, Select, StatusPill } from "@/components/ui";
import { employees } from "@/data/core";
import { leaves } from "@/data/hr";
import { projects, tasks } from "@/data/work";
import { useToast } from "@/lib/store";
import { todayISO } from "@/lib/format";

const WEEK_CAPACITY = 40;
/** rough effort estimate per open task by priority, in hours */
const EFFORT: Record<string, number> = { High: 12, Medium: 8, Low: 4 };

export default function Workload() {
  const nav = useNavigate();
  const { push } = useToast();
  const [dept, setDept] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    return employees
      .filter((e) => dept === "All" || e.department === dept)
      .map((e) => {
        const mine = tasks.filter((t) => t.assignees.includes(e.id) && t.status !== "Completed");
        const allocated = mine.reduce((a, t) => a + (EFFORT[t.priority] ?? 8), 0);
        const leaveDays = leaves.filter((l) => l.employee === e.id && l.status === "Approved").length;
        const capacity = Math.max(0, WEEK_CAPACITY - leaveDays * 8);
        const pct = capacity > 0 ? Math.round((allocated / capacity) * 100) : 100;
        const overdue = mine.filter((t) => t.due < todayISO()).length;
        return { emp: e, mine, allocated, capacity, pct, leaveDays, overdue };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [dept]);

  const over = rows.filter((r) => r.pct > 100);
  const free = rows.filter((r) => r.pct < 60);
  const totalAllocated = rows.reduce((a, r) => a + r.allocated, 0);
  const totalCapacity = rows.reduce((a, r) => a + r.capacity, 0);

  const band = (pct: number) =>
    pct > 100 ? { tone: "bad", label: "Over capacity" } : pct >= 80 ? { tone: "warn", label: "At capacity" } : pct >= 40 ? { tone: "good", label: "Balanced" } : { tone: "info", label: "Has room" };

  return (
    <>
      <PageHeader
        title="Team Workload"
        crumbs={["Work"]}
        actions={
          <button
            className="btn-outline"
            onClick={() => {
              if (over.length === 0) return push("Nobody is over capacity — nothing to rebalance");
              push(`${over.length} over capacity: ${over.map((o) => o.emp.name.split(" ")[0]).join(", ")} — reassign from their task lists`);
            }}
          >
            <AlertTriangle size={15} /> Check overloads
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Team utilisation" value={`${totalCapacity ? Math.round((totalAllocated / totalCapacity) * 100) : 0}%`} icon={Users} sub={`${totalAllocated}h of ${totalCapacity}h this week`} />
        <StatCard label="Over capacity" value={over.length} icon={AlertTriangle} sub={over.length ? over.map((o) => o.emp.name.split(" ")[0]).join(", ") : "nobody"} />
        <StatCard label="Has room" value={free.length} sub="under 60% allocated" />
        <StatCard label="On approved leave" value={rows.reduce((a, r) => a + r.leaveDays, 0)} icon={CalendarOff} sub="days this period" />
      </div>

      <FilterBar>
        <Select label="Department" value={dept} onChange={setDept} options={["All", "Engineering", "Design", "Delivery", "Human Resource"]} />
        <span className="ml-auto flex flex-wrap gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-info" /> Has room</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-good" /> Balanced</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warn" /> At capacity</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-bad" /> Over capacity</span>
        </span>
      </FilterBar>

      <div className="space-y-3">
        {rows.map((r) => {
          const b = band(r.pct);
          const isOpen = expanded === r.emp.id;
          return (
            <div key={r.emp.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-4">
                <AvatarName name={r.emp.name} sub={`${r.emp.designation} · ${r.emp.department}`} size={38} />
                <span className="min-w-52 flex-1">
                  <span className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-muted">{r.allocated}h allocated of {r.capacity}h capacity</span>
                    <span className={clsx("font-bold tabular-nums", r.pct > 100 ? "text-bad" : "text-muted")}>{r.pct}%</span>
                  </span>
                  <span className="block h-2.5 overflow-hidden rounded-full bg-line">
                    <span
                      className={clsx(
                        "block h-full rounded-full transition-all",
                        r.pct > 100 ? "bg-bad" : r.pct >= 80 ? "bg-warn" : r.pct >= 40 ? "bg-good" : "bg-info"
                      )}
                      style={{ width: `${Math.min(r.pct, 100)}%` }}
                    />
                  </span>
                </span>
                <StatusPill status={b.label} tone={b.tone} />
                {r.overdue > 0 && <StatusPill status={`${r.overdue} overdue`} tone="bad" />}
                {r.leaveDays > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <CalendarOff size={12} /> {r.leaveDays}d leave
                  </span>
                )}
                <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setExpanded(isOpen ? null : r.emp.id)}>
                  {isOpen ? "Hide" : `${r.mine.length} task${r.mine.length === 1 ? "" : "s"}`}
                </button>
              </div>

              {isOpen && (
                <ul className="mt-4 space-y-2 border-t border-line pt-4">
                  {r.mine.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white/70 px-3.5 py-2 text-sm">
                      <span className="font-mono text-xs text-faint">{t.code}</span>
                      <span className="min-w-40 flex-1 font-medium">{t.title}</span>
                      <span className="text-xs text-muted">{projects.find((p) => p.id === t.projectId)?.code}</span>
                      <StatusPill status={t.priority} />
                      <span className="text-xs text-muted tabular-nums">~{EFFORT[t.priority] ?? 8}h</span>
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => nav("/work/tasks")}>Open</button>
                    </li>
                  ))}
                  {r.mine.length === 0 && <li className="py-3 text-center text-xs text-faint">No open tasks — available for new work</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-center text-xs text-faint">
        Capacity = {WEEK_CAPACITY}h per week less approved leave · effort estimated from task priority
      </p>
    </>
  );
}
