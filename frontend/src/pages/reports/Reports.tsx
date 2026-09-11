import clsx from "clsx";
import { BarChart3, BookmarkPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/crud";
import { ChartCard, StatCard } from "@/components/StatCard";
import { BarChart, LineChart } from "@/components/charts";
import { Download } from "lucide-react";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { AvatarName, StatusPill } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { expenses, invoices } from "@/data/finance";
import { leaveQuota } from "@/data/hr";
import { loadAttendanceGrid } from "@/lib/api";
import { deals } from "@/data/crm";
import { projects, tasks, timeLogs } from "@/data/work";
import { fmtDate, hoursLabel, money, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

/* Invoice totals are tax-inclusive, so the taxable base is the total net of GST. */
const GST_RATE = 0.18;
const taxableOf = (gross: number) => Math.round(gross / (1 + GST_RATE));

export const REPORTS = [
  { key: "task", title: "Task Report", desc: "Status of every task with due dates" },
  { key: "timelog", title: "Time Log Report", desc: "Hours logged and earnings by employee" },
  { key: "finance", title: "Finance Report", desc: "Earnings, invoices and transaction log" },
  { key: "income-expense", title: "Income Vs Expense", desc: "Monthly income against expenses" },
  { key: "leave", title: "Leave Report", desc: "Quota and remaining leaves per employee" },
  { key: "attendance", title: "Attendance Report", desc: "Present, absent, late and clocked hours" },
  { key: "expense", title: "Expense Report", desc: "Company spend by category" },
  { key: "deal", title: "Deal Report", desc: "Pipeline value and win rate by agent" },
  { key: "sales", title: "Sales Report", desc: "Paid invoices with tax breakdown" },
];

export default function ReportsIndex() {
  return (
    <>
      <PageHeader title="Reports" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.key} to={`/reports/${r.key}`} className="card p-5 hover:border-primary">
            <BarChart3 size={18} className="mb-3 text-primary" />
            <p className="font-semibold">{r.title}</p>
            <p className="mt-1 text-xs text-muted">{r.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

type SavedView = { id: string; name: string; report: string; from: string; to: string; note?: string };

export function ReportPage() {
  const { report } = useParams();
  const meta = REPORTS.find((r) => r.key === report) ?? REPORTS[0];
  const { push } = useToast();
  // Default range: the month so far.
  const [from, setFrom] = useState(() => `${todayISO().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayISO());
  const [saveOpen, setSaveOpen] = useState(false);
  const [views, setViews] = useState<SavedView[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("ws.reportViews") ?? "[]") as SavedView[];
    } catch {
      return [];
    }
  });

  /* The attendance report reads the server's grid for the month `from` lands
     in — attendance is stored per day, so there is nothing to derive locally. */
  const [attendanceRows, setAttendanceRows] = useState<
    Array<{ id: string; name: string; present: number; absent: number; late: number; hours: number }>
  >([]);

  useEffect(() => {
    if (meta.key !== "attendance") return;
    const start = new Date(from);
    if (Number.isNaN(start.getTime())) return;

    let live = true;
    void loadAttendanceGrid(start.getMonth() + 1, start.getFullYear()).then((grid) => {
      if (!live) return;
      setAttendanceRows(
        (grid?.rows ?? []).map((r) => ({
          id: r.employeeId,
          name: r.name,
          present: r.days.filter((d) => d === 1 || d === 3).length,
          absent: r.days.filter((d) => d === 0).length,
          late: r.days.filter((d) => d === 3).length,
          hours: r.days.filter((d) => d === 1 || d === 3).length * 9,
        }))
      );
    });
    return () => {
      live = false;
    };
  }, [meta.key, from]);

  const persistViews = (next: SavedView[]) => {
    setViews(next);
    try {
      localStorage.setItem("ws.reportViews", JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  const myViews = views.filter((v) => v.report === meta.key);

  return (
    <>
      <PageHeader
        title={meta.title}
        crumbs={["Reports"]}
        actions={
          <>
            <button className="btn-outline" onClick={() => setSaveOpen(true)}>
              <BookmarkPlus size={15} /> Save this view
            </button>
            <button className="btn-outline" onClick={() => window.print()}>
              <Download size={15} /> Print / PDF
            </button>
          </>
        }
      />
      <FilterBar>
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Duration</span>
          <input type="date" className="input w-auto py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-faint">to</span>
          <input type="date" className="input w-auto py-1.5" value={to} onChange={(e) => setTo(e.target.value)} />
        </span>
        {[
          ["This month", "2026-08-01", "2026-08-31"],
          ["Last 90 days", "2026-06-01", todayISO()],
          ["This year", "2026-01-01", "2026-12-31"],
        ].map(([label, f, t]) => (
          <button
            key={label}
            className={clsx(
              "btn rounded-full border px-3 py-1 text-xs font-semibold",
              from === f && to === t ? "border-primary bg-primary text-white" : "border-line bg-white/70 text-muted hover:border-primary hover:text-primary"
            )}
            onClick={() => {
              setFrom(f);
              setTo(t);
            }}
          >
            {label}
          </button>
        ))}
      </FilterBar>

      {myViews.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold tracking-wider text-faint uppercase">Saved views</span>
          {myViews.map((v) => (
            <span key={v.id} className="flex items-center gap-1 rounded-full border border-line bg-white/70 py-1 pr-1 pl-3 text-xs">
              <button
                className="cursor-pointer font-semibold text-ink hover:text-primary"
                onClick={() => {
                  setFrom(v.from);
                  setTo(v.to);
                  push(`Loaded “${v.name}”`);
                }}
              >
                {v.name}
              </button>
              <button
                className="cursor-pointer rounded-full p-0.5 text-faint hover:bg-page hover:text-bad"
                aria-label="Delete saved view"
                onClick={() => persistViews(views.filter((x) => x.id !== v.id))}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <FormModal
        open={saveOpen}
        title="Save this report view"
        fields={[
          { key: "name", label: "View name", required: true, placeholder: "e.g. Q3 finance review" },
          { key: "note", label: "Note", type: "textarea", placeholder: "What is this view for?" },
        ]}
        submitLabel="Save view"
        onSubmit={(v) => {
          persistViews([...views, { id: `v-${Date.now()}`, name: String(v.name), report: meta.key, from, to, note: String(v.note ?? "") }]);
          push(`View “${v.name}” saved — ${fmtDate(from)} to ${fmtDate(to)}`);
          setSaveOpen(false);
        }}
        onClose={() => setSaveOpen(false)}
      />
      {meta.key === "task" && (
        <DataTable
          rows={tasks}
          selectable={false}
          columns={[
            { key: "code", label: "Code" },
            { key: "title", label: "Task", render: (t) => <span className="font-medium">{t.title}</span> },
            { key: "project", label: "Project", render: (t) => projects.find((p) => p.id === t.projectId)?.name.slice(0, 34) },
            { key: "due", label: "Due Date", sort: (t) => t.due, render: (t) => <span className={t.due < todayISO() && t.status !== "Completed" ? "text-bad" : ""}>{fmtDate(t.due)}</span> },
            { key: "status", label: "Status", render: (t) => <StatusPill status={t.status} /> },
          ]}
        />
      )}
      {meta.key === "timelog" && (
        <>
          <ChartCard title="Hours per day">
            <LineChart points={[2, 4, 4, 6, 3]} labels={["02 Aug", "07 Aug", "21 Aug", "29 Aug", "30 Aug"]} />
          </ChartCard>
          <div className="h-5" />
          <DataTable
            rows={timeLogs}
            selectable={false}
            columns={[
              { key: "employee", label: "Employee", render: (t) => <AvatarName name={byId(t.employee)?.name ?? "—"} size={28} /> },
              { key: "start", label: "Start Time" },
              { key: "end", label: "End Time" },
              { key: "hours", label: "Total Hours", render: (t) => hoursLabel(t.hours) },
              { key: "earnings", label: "Earnings", render: (t) => money(t.hours * (byId(t.employee)?.hourly ?? 0)) },
            ]}
          />
        </>
      )}
      {meta.key === "finance" && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Earnings" value={money(invoices.reduce((a, i) => a + i.paid, 0))} />
            <StatCard label="Total Invoices" value={invoices.length} />
            <StatCard label="Pending Amount" value={money(invoices.reduce((a, i) => a + i.total - i.paid, 0))} />
            <StatCard label="Avg Daily Receipt" value={money(41865.17)} />
          </div>
          <DataTable
            rows={invoices.filter((i) => i.status === "Paid")}
            selectable={false}
            columns={[
              { key: "number", label: "Invoice" },
              { key: "total", label: "Amount", render: (i) => money(i.total) },
              { key: "date", label: "Paid On", render: (i) => fmtDate(i.date) },
              { key: "status", label: "Status", render: (i) => <StatusPill status={i.status} /> },
            ]}
          />
        </>
      )}
      {meta.key === "income-expense" && (
        <ChartCard title="Income vs Expense — Aug 2026">
          <BarChart
            data={["04", "07", "10", "17", "19", "22", "23"].map((d, i) => ({
              label: `${d} Aug`,
              values: [
                { name: "Income", value: [59, 41, 64, 27, 0, 40, 21][i] * 1000, color: "#5b5ceb" },
                { name: "Expense", value: [0, 0, 0, 0, 942, 0, 0][i], color: "#e85d51" },
              ],
            }))}
            yFmt={(v) => `$${Math.round(v / 1000)}k`}
          />
        </ChartCard>
      )}
      {meta.key === "leave" && (
        <DataTable
          rows={leaveQuota.map((q) => ({ id: q.employee, ...q }))}
          selectable={false}
          columns={[
            { key: "employee", label: "Employee", render: (q) => <AvatarName name={byId(q.employee)?.name ?? "—"} sub={byId(q.employee)?.designation} /> },
            { key: "total", label: "Total Leave", render: (q) => q.total.toFixed(2), className: "tabular-nums" },
            { key: "taken", label: "Taken", className: "tabular-nums" },
            { key: "rem", label: "Remaining Leaves", render: (q) => (q.total - q.taken).toFixed(2), className: "tabular-nums" },
          ]}
        />
      )}
      {meta.key === "attendance" && (
        <DataTable
          rows={attendanceRows}
          selectable={false}
          columns={[
            { key: "name", label: "Employee", render: (r) => <AvatarName name={r.name} size={28} /> },
            { key: "present", label: "Present", className: "tabular-nums" },
            { key: "absent", label: "Absent", className: "tabular-nums" },
            { key: "late", label: "Day(s) Late", className: "tabular-nums" },
            { key: "hours", label: "Hours Clocked", render: (r) => `${r.hours}hrs 0mins` },
          ]}
        />
      )}
      {meta.key === "expense" && (
        <DataTable
          rows={expenses}
          selectable={false}
          columns={[
            { key: "item", label: "Item Name", render: (e) => <span className="font-medium">{e.item}</span> },
            { key: "price", label: "Price", render: (e) => money(e.price) },
            { key: "category", label: "Category" },
            { key: "date", label: "Purchase Date", render: (e) => fmtDate(e.date) },
            { key: "status", label: "Status", render: (e) => <StatusPill status={e.status} /> },
          ]}
        />
      )}
      {meta.key === "deal" && (
        <DataTable
          rows={["e3", "e7", "e10"].map((agent) => ({
            id: agent,
            agent,
            total: deals.filter((d) => d.agent === agent).length,
            won: deals.filter((d) => d.agent === agent && d.stage === "won").length,
            lost: deals.filter((d) => d.agent === agent && d.stage === "lost").length,
            value: deals.filter((d) => d.agent === agent).reduce((a, d) => a + d.value, 0),
          }))}
          selectable={false}
          columns={[
            { key: "agent", label: "Deal Agent", render: (r) => <AvatarName name={byId(r.agent)?.name ?? "—"} size={28} /> },
            { key: "total", label: "Total Deals", className: "tabular-nums" },
            { key: "won", label: "Won Deals", className: "tabular-nums" },
            { key: "lost", label: "Lost Deals", className: "tabular-nums" },
            { key: "value", label: "Total Amount", render: (r) => money(r.value) },
          ]}
        />
      )}
      {meta.key === "sales" && (
        <DataTable
          rows={invoices.filter((i) => i.paid > 0)}
          selectable={false}
          columns={[
            { key: "date", label: "Paid On", render: (i) => fmtDate(i.date) },
            { key: "number", label: "Invoice Number" },
            { key: "total", label: "Invoice Value", render: (i) => money(i.total) },
            { key: "paid", label: "Amount Paid", render: (i) => money(i.paid) },
            { key: "tax", label: "Taxable Value", render: (i) => money(taxableOf(i.paid)) },
            { key: "gst", label: "GST", render: (i) => money(i.paid - taxableOf(i.paid)), className: "tabular-nums" },
          ]}
        />
      )}
    </>
  );
}
