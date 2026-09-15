import clsx from "clsx";
import { CalendarPlus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { api, can, decideLeave, loadOutToday, type OutToday } from "@/lib/api";
import { FilterBar, PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { AvatarName, Modal, Select, StatusPill } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { leaves } from "@/data/hr";
import { fmtDate, todayISO } from "@/lib/format";
import { allBalances, balanceFor, hasEntitlement, leaveTypeIdFor, leaveTypes, validateLeave } from "@/lib/leaveBalance";
import { CURRENT_USER, useToast } from "@/lib/store";

export default function Leaves() {
  const [status, setStatus] = useState("All");
  const [type, setType] = useState("All");
  const { push } = useToast();
  const [applyOpen, setApplyOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [form, setForm] = useState({ employee: CURRENT_USER.id, type: "", duration: "Full Day", date: todayISO(), reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [outToday, setOutToday] = useState<OutToday[]>([]);

  useEffect(() => {
    void loadOutToday().then(setOutToday);
  }, []);

  /* Deciding leave is HR's job, and the server gates it on leave:approve.
     Without it the page is a personal record: your own requests, and who is
     out today — no approve, no reject, no editing someone else's absence. */
  const mayDecide = can("leave:approve");

  /* The organisation's own leave types, not a hardcoded three. Empty until HR
     configures them, which is why every picker below falls back to this list
     rather than a constant. */
  const typeNames = leaveTypes().map((t) => t.name);
  const activeType = form.type || typeNames[0] || "";

  const crud = useCrud({
    collection: "leaves",
    seed: leaves,
    itemName: "Leave",
    fields: [
      { key: "employee", label: "Choose Member", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })), required: true },
      { key: "type", label: "Leave Type", type: "select", options: typeNames },
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
  const selected = balanceFor(form.employee, activeType);

  /* Entitlement is the server's arithmetic, not ours: it nets off approved
     leave and holds back what is still pending. Re-read it once the write has
     landed, or the tiles keep showing the balance from before the request. */
  const refreshBalances = () => {
    void api.settled().then(() => api.refresh("leaveQuota"));
  };

  /* Deciding leave goes through its own endpoint, not an edit of the row: the
     server moves the days from pending to used and records who decided it. */
  const decide = async (l: { id: string | number; employee: string }, decision: "APPROVED" | "REJECTED") => {
    const ok = await decideLeave(String(l.id), decision);
    if (!ok) return; // the API layer announced why
    refreshBalances();
    push(
      decision === "APPROVED"
        ? `Leave approved for ${byId(l.employee)?.name ?? "employee"}`
        : "Leave rejected"
    );
  };

  const decideMany = async (
    rows: Array<{ id: string | number; employee: string }>,
    decision: "APPROVED" | "REJECTED"
  ) => {
    const results = await Promise.all(rows.map((r) => decideLeave(String(r.id), decision)));
    const done = results.filter(Boolean).length;
    refreshBalances();
    if (done) {
      push(`${done} request${done === 1 ? "" : "s"} ${decision === "APPROVED" ? "approved" : "rejected"}`);
    }
  };

  const submit = () => {
    const err = validateLeave(form.employee, activeType, form.duration, form.date);
    if (err) return setError(err);
    // The API keys leave by type id; the picker only knows the name.
    crud.add({ ...form, type: activeType, leaveTypeId: leaveTypeIdFor(activeType) });
    refreshBalances();
    setApplyOpen(false);
    setError(null);
  };

  const pendingCount = crud.items.filter((l) => l.status === "Pending").length;
  /* No employee record behind this login means no entitlement to show. Saying
     so beats three tiles reading 0 / 0, which looks like an allowance of none. */
  const entitled = hasEntitlement(CURRENT_USER.id);

  return (
    <>
      <PageHeader
        title="Leaves"
        crumbs={["HR"]}
        actions={
          <>
            <button
              className="btn-primary"
              disabled={!entitled}
              title={entitled ? undefined : "Your sign-in has no employee record yet"}
              onClick={() => { setError(null); setApplyOpen(true); }}
            >
              <CalendarPlus size={15} /> Apply for leave
            </button>
            {mayDecide && (
              <button className="btn-outline" onClick={crud.openNew}>
                <Plus size={15} /> Assign leave
              </button>
            )}
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

      {!entitled && (
        <div className="card mb-5 px-4 py-3 text-sm text-muted">
          Your sign-in is not linked to an employee record yet, so there is no
          leave entitlement to show. Ask HR to connect them.
        </div>
      )}

      {/* Who is off today, for everyone. An employee cannot see the leave list
          itself — those carry reasons — but needs to know whether a colleague
          is around before waiting on a reply. */}
      <div className="card mb-5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            Out today
          </span>
          {outToday.length === 0 ? (
            <span className="text-sm text-faint">Everyone is in today</span>
          ) : (
            outToday.map((o) => (
              <span
                key={o.id}
                className="flex items-center gap-1.5 rounded-full bg-page py-1 pr-3 pl-1"
                title={`${o.employeeName} — back ${fmtDate(String(o.endsOn).slice(0, 10))}`}
              >
                <AvatarName name={o.employeeName} size={22} />
                {o.halfDay && <span className="text-[11px] text-muted">half day</span>}
              </span>
            ))
          )}
        </div>
      </div>

      <FilterBar>
        <Select label="Status" value={status} onChange={setStatus} options={["All", "Approved", "Pending", "Rejected"]} />
        <Select label="Leave Type" value={type} onChange={setType} options={["All", ...typeNames]} />
        {mayDecide && (
          <button className="btn-outline ml-auto px-3 py-1.5 text-xs" onClick={() => setTeamOpen(true)}>
            View team balances
          </button>
        )}
      </FilterBar>

      <DataTable
        rows={rows}
        exportName="leaves"
        onBulkDelete={mayDecide ? crud.removeMany : undefined}
        bulkActions={
          mayDecide
            ? [
                { label: "Approve", onClick: (rs) => void decideMany(rs, "APPROVED") },
                { label: "Reject", danger: true, onClick: (rs) => void decideMany(rs, "REJECTED") },
              ]
            : []
        }
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
            mayDecide && l.status === "Pending"
              ? [
                  { label: "Approve", onClick: () => void decide(l, "APPROVED") },
                  { label: "Reject", danger: true, onClick: () => void decide(l, "REJECTED") },
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
            {/* You apply for your own leave. Only someone who decides leave may
                file it on another person's behalf, so everyone else sees their
                own name rather than a list of colleagues to choose from. */}
            {mayDecide ? (
              <select className="input" value={form.employee} onChange={(e) => { setForm({ ...form, employee: e.target.value }); setError(null); }}>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            ) : (
              <p className="input flex items-center bg-page text-muted">
                {byId(CURRENT_USER.id)?.name ?? CURRENT_USER.name}
              </p>
            )}
          </label>
          <label className="block">
            <span className="lbl">Leave type</span>
            <select className="input" value={activeType} onChange={(e) => { setForm({ ...form, type: e.target.value }); setError(null); }}>
              {typeNames.map((t) => <option key={t}>{t}</option>)}
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
            {/* Leave is asked for ahead of time, so the picker starts today.
                Recording leave that has already happened is a correction, and
                that belongs to whoever decides leave. */}
            <input
              type="date"
              className="input"
              min={mayDecide ? undefined : todayISO()}
              value={form.date}
              onChange={(e) => { setForm({ ...form, date: e.target.value }); setError(null); }}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="lbl">Reason</span>
            <textarea rows={3} className="input resize-y" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Family function, medical appointment…" />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {formBalances.map((b) => (
            <div key={b.type} className={clsx("rounded-xl border p-3", b.type === activeType ? "border-primary bg-primary-soft" : "border-line bg-white/70")}>
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
                {typeNames.map((t) => <th key={t} className="text-center">{t}</th>)}
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
