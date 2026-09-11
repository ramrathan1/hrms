import clsx from "clsx";
import { CalendarPlus, Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { FilterBar, PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { AvatarName, Modal, Select, StatusPill } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { leaves } from "@/data/hr";
import { fmtDate } from "@/lib/format";
import { LEAVE_TYPES, allBalances, balanceFor, validateLeave } from "@/lib/leaveBalance";
import { CURRENT_USER, useToast } from "@/lib/store";

export default function Leaves() {
  const [status, setStatus] = useState("All");
  const [type, setType] = useState("All");
  const { push } = useToast();
  const [applyOpen, setApplyOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [form, setForm] = useState({ employee: CURRENT_USER.id, type: "Casual", duration: "Full Day", date: "2026-09-02", reason: "" });
  const [error, setError] = useState<string | null>(null);

  const crud = useCrud({
    collection: "leaves",
    seed: leaves,
    itemName: "Leave",
    fields: [
      { key: "employee", label: "Choose Member", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })), required: true },
      { key: "type", label: "Leave Type", type: "select", options: LEAVE_TYPES },
      { key: "duration", label: "Select Duration", type: "select", options: ["Full Day", "First Half", "Second Half"] },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Approved", "Rejected"] },
      { key: "reason", label: "Reason for absence", type: "textarea" },
    ],
    defaults: { date: "2026-09-01", status: "Pending" } as never,
  });

  const rows = crud.items.filter(
    (l) => (status === "All" || l.status === status) && (type === "All" || l.type === type)
  );

  const formBalances = allBalances(form.employee);
  const selected = balanceFor(form.employee, form.type);

  const submit = () => {
    const err = validateLeave(form.employee, form.type, form.duration, form.date);
    if (err) return setError(err);
    crud.add({ ...form });
    const left = selected.remaining - (form.duration === "Full Day" ? 1 : 0.5);
    push(`Leave requested — ${left} ${form.type.toLowerCase()} day${left === 1 ? "" : "s"} left`);
    setApplyOpen(false);
    setError(null);
  };

  const pendingCount = crud.items.filter((l) => l.status === "Pending").length;

  return (
    <>
      <PageHeader
        title="Leaves"
        crumbs={["HR"]}
        actions={
          <>
            <button className="btn-primary" onClick={() => { setError(null); setApplyOpen(true); }}>
              <CalendarPlus size={15} /> Apply for leave
            </button>
            <button className="btn-outline" onClick={crud.openNew}>
              <Plus size={15} /> Assign leave
            </button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending requests" value={pendingCount} sub="awaiting approval" />
        {allBalances(CURRENT_USER.id).map((b) => (
          <StatCard
            key={b.type}
            label={`My ${b.type.toLowerCase()} leave`}
            value={`${b.remaining} / ${b.quota}`}
            sub={`${b.taken} taken${b.pending ? ` · ${b.pending} pending` : ""}`}
          />
        ))}
      </div>

      <FilterBar>
        <Select label="Status" value={status} onChange={setStatus} options={["All", "Approved", "Pending", "Rejected"]} />
        <Select label="Leave Type" value={type} onChange={setType} options={["All", ...LEAVE_TYPES]} />
        <button className="btn-outline ml-auto px-3 py-1.5 text-xs" onClick={() => setTeamOpen(true)}>
          View team balances
        </button>
      </FilterBar>

      <DataTable
        rows={rows}
        exportName="leaves"
        onBulkDelete={crud.removeMany}
        bulkActions={[
          { label: "Approve", onClick: (rs) => crud.updateMany(rs, { status: "Approved" } as never, "approved") },
          { label: "Reject", danger: true, onClick: (rs) => crud.updateMany(rs, { status: "Rejected" } as never, "rejected") },
        ]}
        columns={[
          { key: "employee", label: "Employee", render: (l) => <AvatarName name={byId(l.employee)?.name ?? "—"} sub={byId(l.employee)?.designation} /> },
          { key: "date", label: "Leave Date", sort: (l) => l.date, render: (l) => fmtDate(l.date) },
          { key: "duration", label: "Duration" },
          { key: "type", label: "Leave Type" },
          {
            key: "balance",
            label: "Balance",
            render: (l) => {
              const b = balanceFor(l.employee, l.type);
              return (
                <span className={clsx("text-xs font-medium tabular-nums", b.remaining === 0 ? "text-bad" : b.remaining <= 3 ? "text-warn" : "text-muted")}>
                  {b.remaining} / {b.quota} left
                </span>
              );
            },
          },
          { key: "reason", label: "Reason", render: (l) => <span className="text-muted">{l.reason}</span> },
          { key: "status", label: "Status", render: (l) => <StatusPill status={l.status} /> },
        ]}
        rowActions={(l) =>
          crud.rowActions(
            l,
            l.status === "Pending"
              ? [
                  { label: "Approve", onClick: () => { crud.update(l.id, { status: "Approved" } as never, true); push(`Leave approved for ${byId(l.employee)?.name}`); } },
                  { label: "Reject", danger: true, onClick: () => { crud.update(l.id, { status: "Rejected" } as never, true); push("Leave rejected"); } },
                ]
              : []
          )
        }
      />

      {/* apply with live entitlement checking */}
      <Modal open={applyOpen} onClose={() => setApplyOpen(false)} title="Apply for leave" wide>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <span className="lbl">Employee</span>
            <select className="input" value={form.employee} onChange={(e) => { setForm({ ...form, employee: e.target.value }); setError(null); }}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="lbl">Leave type</span>
            <select className="input" value={form.type} onChange={(e) => { setForm({ ...form, type: e.target.value }); setError(null); }}>
              {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="lbl">Duration</span>
            <select className="input" value={form.duration} onChange={(e) => { setForm({ ...form, duration: e.target.value }); setError(null); }}>
              {["Full Day", "First Half", "Second Half"].map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="lbl">Date</span>
            <input type="date" className="input" value={form.date} onChange={(e) => { setForm({ ...form, date: e.target.value }); setError(null); }} />
          </label>
          <label className="block md:col-span-2">
            <span className="lbl">Reason</span>
            <textarea rows={3} className="input resize-y" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Family function, medical appointment…" />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {formBalances.map((b) => (
            <div key={b.type} className={clsx("rounded-xl border p-3", b.type === form.type ? "border-primary bg-primary-soft" : "border-line bg-white/70")}>
              <p className="text-xs font-semibold text-muted">{b.type}</p>
              <p className="mt-0.5 font-display text-lg font-bold tabular-nums">
                {b.remaining}
                <span className="text-xs font-medium text-muted"> / {b.quota}</span>
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                <span
                  className={clsx("block h-full rounded-full", b.remaining === 0 ? "bg-bad" : b.remaining <= 3 ? "bg-warn" : "bg-good")}
                  style={{ width: `${(b.remaining / b.quota) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {error && <p className="mt-4 rounded-lg bg-bad-soft px-3.5 py-2.5 text-sm font-medium text-bad">⚠ {error}</p>}

        <div className="mt-5 flex gap-3">
          <button className="btn-primary" onClick={submit}>Submit request</button>
          <button className="btn-ghost" onClick={() => setApplyOpen(false)}>Cancel</button>
        </div>
      </Modal>

      {/* team balances */}
      <Modal open={teamOpen} onClose={() => setTeamOpen(false)} title="Team leave balances" wide>
        <div className="overflow-x-auto">
          <table className="tbl w-full text-sm">
            <thead>
              <tr>
                <th>Employee</th>
                {LEAVE_TYPES.map((t) => <th key={t} className="text-center">{t}</th>)}
                <th className="text-right">Total left</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const bs = allBalances(e.id);
                const total = bs.reduce((a, b) => a + b.remaining, 0);
                return (
                  <tr key={e.id}>
                    <td><AvatarName name={e.name} sub={e.designation} size={26} /></td>
                    {bs.map((b) => (
                      <td key={b.type} className="text-center">
                        <span className={clsx("font-semibold tabular-nums", b.remaining === 0 ? "text-bad" : b.remaining <= 3 ? "text-warn" : "text-ink")}>
                          {b.remaining}
                        </span>
                        <span className="text-xs text-faint"> / {b.quota}</span>
                      </td>
                    ))}
                    <td className="text-right font-bold tabular-nums">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Modal>

      {crud.modals}
    </>
  );
}
