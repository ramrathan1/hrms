import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CheckSquare, ClipboardList, FolderKanban, Headphones } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, ChartCard } from "@/components/StatCard";
import { BarChart } from "@/components/charts";
import { AvatarName, StatusPill } from "@/components/ui";
import { byId } from "@/data/core";
import { projects, tasks } from "@/data/work";
import { tickets, todos as todoSeed, events } from "@/data/ops";
import { leaves } from "@/data/hr";
import { api } from "@/lib/api";
import { CURRENT_USER } from "@/lib/store";
import { fmtDate, todayISO } from "@/lib/format";

export default function PrivateDashboard() {
  const [todos, setTodos] = useState(todoSeed);
  const myTasks = tasks.filter((t) => t.status !== "Completed").slice(0, 6);

  /* Whoever is actually approved to be off today — this used to name one
     hardcoded person from the demo data. */
  const onLeaveToday = leaves.filter(
    (l) =>
      l.status === "Approved" &&
      l.date <= todayISO() &&
      (l.endDate ?? l.date) >= todayISO()
  );
  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="card mb-5 flex items-center justify-between px-6 py-5">
        <div>
          <h2 className="text-lg font-bold">Welcome back, {CURRENT_USER.name.split(" ")[0]} 👋</h2>
          <p className="text-sm text-muted">
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}You have {myTasks.length} open tasks and {tickets.filter((t) => t.status === "Open").length} open tickets.
          </p>
        </div>
        <AvatarName name={CURRENT_USER.name} sub={CURRENT_USER.role} size={44} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open Tasks" value={tasks.filter((t) => t.status !== "Completed").length} icon={CheckSquare} trend={{ value: "-8%", up: true }} sub="vs last week" />
        <StatCard label="Projects In Progress" value={projects.filter((p) => p.status === "In Progress").length} icon={FolderKanban} trend={{ value: "+1", up: true }} sub="vs last week" />
        <StatCard label="Open Tickets" value={tickets.filter((t) => t.status === "Open").length} icon={Headphones} trend={{ value: "+2", up: false }} sub="needs attention" />
        <StatCard label="Upcoming Events" value={events.filter((e) => e.date >= todayISO()).length} icon={CalendarDays} sub="next 14 days" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard title="My Tasks" actions={<Link to="/work/tasks" className="text-sm text-primary">View all</Link>}>
            <div className="overflow-x-auto">
              <table className="tbl w-full text-sm">
                <thead>
                  <tr><th>Task</th><th>Project</th><th>Due Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {myTasks.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <span className="font-medium">{t.title}</span>
                        <span className="ml-2 text-xs text-faint">{t.code}</span>
                      </td>
                      <td className="text-muted">{projects.find((p) => p.id === t.projectId)?.name.slice(0, 28)}</td>
                      <td className={t.due < todayISO() ? "text-bad" : ""}>{fmtDate(t.due)}</td>
                      <td><StatusPill status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
          <div className="h-5" />
          <ChartCard title="Week Timelogs">
            <BarChart
              height={200}
              data={[
                { label: "Mon", values: [{ name: "h", value: 6, color: "#5b5ceb" }] },
                { label: "Tue", values: [{ name: "h", value: 7, color: "#5b5ceb" }] },
                { label: "Wed", values: [{ name: "h", value: 5, color: "#5b5ceb" }] },
                { label: "Thu", values: [{ name: "h", value: 8, color: "#5b5ceb" }] },
                { label: "Fri", values: [{ name: "h", value: 6, color: "#5b5ceb" }] },
                { label: "Sat", values: [{ name: "h", value: 2, color: "#5b5ceb" }] },
              ]}
              yFmt={(v) => `${v}h`}
            />
          </ChartCard>
        </div>
        <div className="space-y-5">
          <ChartCard title="My To-Dos">
            <ul className="space-y-2.5">
              {todos.map((t) => (
                <li key={t.id} className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => {
                      setTodos((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
                      void api.update("todos", t.id, { done: !t.done });
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className={t.done ? "text-faint line-through" : ""}>{t.text}</span>
                </li>
              ))}
            </ul>
          </ChartCard>
          <ChartCard title="Upcoming">
            <ul className="space-y-3">
              {events
                .filter((e) => e.date >= todayISO())
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((e, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                    <span className="flex-1 font-medium">{e.title}</span>
                    <span className="text-xs text-muted tabular-nums">{fmtDate(e.date)}</span>
                  </li>
                ))}
            </ul>
          </ChartCard>
          <ChartCard title="On Leave Today">
            {onLeaveToday.length === 0 ? (
              <p className="py-2 text-sm text-muted">Everyone is in today.</p>
            ) : (
              <ul className="space-y-3">
                {onLeaveToday.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 text-sm">
                    <AvatarName
                      name={byId(l.employee)?.name ?? l.employeeName ?? "Someone"}
                      sub={`${l.type || "Leave"} · ${l.duration}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </div>
      </div>
    </>
  );
}
