import { Download, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/crud";
import { EmailComposeModal } from "@/components/EmailComposeModal";
import { PageHeader } from "@/components/PageHeader";
import { AvatarName, Modal, Select, StatusPill, Tabs } from "@/components/ui";
import { byId } from "@/data/core";
import {
  overtimeRequests as otSeed,
  payslips as payslipSeed,
  salaries as salarySeed,
  salaryHistory as historySeed,
} from "@/data/people2";
import { api, reviseSalary } from "@/lib/api";
import { fmtDate, money, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

type Payslip = (typeof payslipSeed)[number] & { period: string };
type Salary = (typeof salarySeed)[number];
type Revision = (typeof historySeed)[number];

export default function Payroll() {
  const [tab, setTab] = useState("Generate Payroll");
  const [month, setMonth] = useState("August");
  const [year, setYear] = useState("2026");
  const { push } = useToast();

  const [payslips, setPayslips] = useState<Payslip[]>(() => [...payslipSeed]);
  const [salaries, setSalaries] = useState<Salary[]>(() => [...salarySeed]);
  const [history, setHistory] = useState<Revision[]>(() => [...historySeed]);
  const [overtime, setOvertime] = useState(() => [...otSeed]);

  const [viewSlip, setViewSlip] = useState<Payslip | null>(null);
  const [emailSlip, setEmailSlip] = useState<Payslip | null>(null);
  const [revising, setRevising] = useState<Salary | null>(null);
  const [historyFor, setHistoryFor] = useState<Salary | null>(null);

  /* A weekly cycle pays annual/52 and is booked to its own period, so the two
     cycles never overwrite each other's payslips. */
  const [cycle, setCycle] = useState("Monthly");
  const periodsPerYear = cycle === "Weekly" ? 52 : 12;
  const period = cycle === "Weekly" ? `${month.slice(0, 3)} ${year} · weekly` : `${month.slice(0, 3)} ${year}`;
  const periodSlips = useMemo(() => payslips.filter((p) => p.period === period), [payslips, period]);

  const generate = () => {
    const fresh: Payslip[] = salaries.map((s) => {
      const gross = Math.round(s.annual / periodsPerYear);
      return {
        id: `ps-${period.replace(/[ ·]+/g, "-").toLowerCase()}-${s.employee}`,
        employee: s.employee,
        period,
        gross,
        deductions: Math.round(gross * 0.08),
        status: "Pending",
      };
    });
    setPayslips((old) => [...old.filter((p) => p.period !== period), ...fresh]);
    payslipSeed.splice(0, payslipSeed.length, ...[...payslips.filter((p) => p.period !== period), ...fresh]);
    fresh.forEach((p) => void api.replace("payslips", p.id, p));
    push(`Payroll generated for ${fresh.length} employees — ${period}`);
  };

  const markPaid = (id: string) => {
    setPayslips((ps) => ps.map((p) => (p.id === id ? { ...p, status: "Paid" } : p)));
    void api.update("payslips", id, { status: "Paid" });
    push("Payslip marked as paid");
  };

  const deleteSlip = (id: string) => {
    setPayslips((ps) => ps.filter((p) => p.id !== id));
    void api.remove("payslips", id);
    push("Payslip deleted");
  };

  const decideOvertime = (id: string, status: "Approved" | "Rejected") => {
    setOvertime((os) => os.map((o) => (o.id === id ? { ...o, status } : o)));
    void api.update("overtimeRequests", id, { status });
    push(`Overtime ${status.toLowerCase()}`);
  };

  return (
    <>
      <PageHeader title="Payroll" />
      <div className="card mb-5 px-2">
        <Tabs tabs={["Generate Payroll", "Employee Salary", "Overtime Requests", "Payroll Reports"]} active={tab} onChange={setTab} className="border-b-0" />
      </div>

      {tab === "Generate Payroll" && (
        <>
          <div className="card mb-5 flex flex-wrap items-center gap-4 px-5 py-4">
            <Select label="Month" value={month} onChange={setMonth} options={["June", "July", "August", "September"]} />
            <Select label="Year" value={year} onChange={setYear} options={["2026", "2025"]} />
            <Select label="Payment Cycle" value={cycle} onChange={setCycle} options={["Monthly", "Weekly"]} />
            <button className="btn-primary" onClick={generate}>
              <Play size={14} /> Generate Payroll
            </button>
            <span className="text-xs text-muted">
              {periodSlips.length > 0 ? `${periodSlips.length} payslips for ${period}` : `No payroll run yet for ${period} — hit Generate`}
            </span>
          </div>
          <DataTable
            rows={periodSlips}
            columns={[
              { key: "employee", label: "Employee", render: (p) => <AvatarName name={byId(p.employee)?.name ?? "—"} sub={byId(p.employee)?.designation} /> },
              { key: "period", label: "Period" },
              { key: "gross", label: "Gross Salary", sort: (p) => p.gross, render: (p) => money(p.gross) },
              { key: "deductions", label: "Deductions", render: (p) => <span className="text-bad tabular-nums">-{money(p.deductions)}</span> },
              { key: "net", label: "Net Pay", render: (p) => <span className="font-semibold tabular-nums">{money(p.gross - p.deductions)}</span> },
              { key: "status", label: "Status", render: (p) => <StatusPill status={p.status} /> },
            ]}
            exportName={`payroll-${period.replace(" ", "-")}`}
            bulkActions={[
              {
                label: "Mark Paid",
                onClick: (rs) => {
                  rs.forEach((r) => markPaid(r.id));
                },
              },
              {
                label: "Email payslips",
                onClick: (rs) => {
                  rs.forEach((r) =>
                    void api.create("outbox", {
                      to: byId(r.employee)?.email,
                      subject: `Your payslip — ${r.period}`,
                      body: `Hi ${byId(r.employee)?.name.split(" ")[0]},\n\nYour payslip for ${r.period} is attached. Net pay: ${money(r.gross - r.deductions)}.\n\nWorksuite Payroll`,
                      attachment: `payslip-${r.period}.pdf`,
                      date: new Date().toISOString(),
                    })
                  );
                  push(`${rs.length} payslips emailed`);
                },
              },
            ]}
            rowActions={(p) => [
              { label: "View Payslip", onClick: () => setViewSlip(p) },
              { label: "Email Payslip", onClick: () => setEmailSlip(p) },
              ...(p.status !== "Paid" ? [{ label: "Mark Paid", onClick: () => markPaid(p.id) }] : []),
              { label: "Delete", danger: true, onClick: () => deleteSlip(p.id) },
            ]}
            emptyText={`No payslips for ${period} — generate the payroll above`}
          />
        </>
      )}

      {tab === "Employee Salary" && (
        <DataTable
          rows={salaries.map((s) => ({ id: s.employee, ...s }))}
          columns={[
            { key: "employee", label: "Employee", render: (s) => <AvatarName name={byId(s.employee)?.name ?? "—"} sub={byId(s.employee)?.designation} /> },
            { key: "annual", label: "Annual CTC", sort: (s) => s.annual, render: (s) => money(s.annual) },
            { key: "monthly", label: "Monthly Gross", render: (s) => money(Math.round(s.annual / 12)) },
            { key: "cycle", label: "Cycle" },
            { key: "updated", label: "Last Revised", render: (s) => fmtDate(s.updated) },
          ]}
          rowActions={(s) => [
            { label: "Revise Salary", onClick: () => setRevising(s) },
            { label: "View History", onClick: () => setHistoryFor(s) },
            { label: "View Payslips", onClick: () => setTab("Generate Payroll") },
          ]}
        />
      )}

      {tab === "Overtime Requests" && (
        <DataTable
          rows={overtime}
          columns={[
            { key: "employee", label: "Employee", render: (o) => <AvatarName name={byId(o.employee)?.name ?? "—"} size={28} /> },
            { key: "date", label: "Date", render: (o) => fmtDate(o.date) },
            { key: "hours", label: "Hours", className: "tabular-nums" },
            { key: "reason", label: "Reason", render: (o) => <span className="text-muted">{o.reason}</span> },
            { key: "status", label: "Status", render: (o) => <StatusPill status={o.status} /> },
          ]}
          rowActions={(o) =>
            o.status === "Pending"
              ? [
                  { label: "Approve", onClick: () => decideOvertime(o.id, "Approved") },
                  { label: "Reject", danger: true, onClick: () => decideOvertime(o.id, "Rejected") },
                ]
              : [{ label: o.status === "Approved" ? "Mark Rejected" : "Mark Approved", onClick: () => decideOvertime(o.id, o.status === "Approved" ? "Rejected" : "Approved") }]
          }
        />
      )}

      {tab === "Payroll Reports" && (
        <div className="card p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ["Total Payroll", payslips.reduce((a, p) => a + p.gross - p.deductions, 0), "text-primary"],
              ["Paid", payslips.filter((p) => p.status === "Paid").reduce((a, p) => a + p.gross - p.deductions, 0), "text-good"],
              ["Pending", payslips.filter((p) => p.status === "Pending").reduce((a, p) => a + p.gross - p.deductions, 0), "text-warn"],
            ].map(([label, val, cls]) => (
              <div key={label as string} className="rounded-xl border border-line p-5">
                <p className="text-sm text-muted">{label}</p>
                <p className={`mt-1 text-xl font-bold tabular-nums ${cls}`}>{money(val as number)}</p>
              </div>
            ))}
          </div>
          <button
            className="btn-outline mt-5"
            onClick={() => {
              const rows = payslips.map((p) => [byId(p.employee)?.name, p.period, p.gross, p.deductions, p.gross - p.deductions, p.status].join(","));
              const blob = new Blob([["Employee,Period,Gross,Deductions,Net,Status", ...rows].join("\n")], { type: "text/csv" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "payroll.csv";
              a.click();
              push("Payroll sheet downloaded (CSV)");
            }}
          >
            <Download size={15} /> Download payroll sheet (CSV)
          </button>
        </div>
      )}

      {/* payslip viewer */}
      <Modal open={viewSlip !== null} onClose={() => setViewSlip(null)} title={`Payslip — ${viewSlip?.period ?? ""}`}>
        {viewSlip && (
          <div className="text-sm">
            <div className="mb-4 flex items-center justify-between">
              <AvatarName name={byId(viewSlip.employee)?.name ?? "—"} sub={byId(viewSlip.employee)?.designation} />
              <StatusPill status={viewSlip.status} />
            </div>
            {[
              ["Basic Salary (70%)", viewSlip.gross * 0.7],
              ["House Rent Allowance (20%)", viewSlip.gross * 0.2],
              ["Other Allowances (10%)", viewSlip.gross * 0.1],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between border-b border-line py-2">
                <span className="text-muted">{l}</span>
                <span className="tabular-nums">{money(Math.round(v as number))}</span>
              </div>
            ))}
            <div className="flex justify-between border-b border-line py-2">
              <span className="text-muted">Gross</span>
              <span className="font-medium tabular-nums">{money(viewSlip.gross)}</span>
            </div>
            <div className="flex justify-between border-b border-line py-2 text-bad">
              <span>Deductions (tax + PF)</span>
              <span className="tabular-nums">-{money(viewSlip.deductions)}</span>
            </div>
            <div className="flex justify-between py-3 text-base font-bold">
              <span>Net Pay</span>
              <span className="tabular-nums">{money(viewSlip.gross - viewSlip.deductions)}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn-outline flex-1" onClick={() => { window.print(); }}>
                <Download size={14} /> Print / PDF
              </button>
              <button className="btn-primary flex-1" onClick={() => { setEmailSlip(viewSlip); setViewSlip(null); }}>
                Email payslip
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* revise salary */}
      <FormModal
        open={revising !== null}
        title={`Revise salary — ${byId(revising?.employee)?.name ?? ""}`}
        fields={[
          { key: "annual", label: "New Annual CTC", type: "number", required: true },
          { key: "date", label: "Effective From", type: "date", required: true },
          { key: "note", label: "Reason / note", type: "textarea", placeholder: "e.g. Annual review, promotion…" },
        ]}
        initial={revising ? { annual: revising.annual, date: todayISO(), note: "" } : null}
        submitLabel="Revise"
        onSubmit={async (v) => {
          if (!revising) return;
          const to = Number(v.annual);
          const who = byId(revising.employee)?.name ?? "employee";
          setRevising(null);

          /* One call: the server closes the old salary band, records the
             change and opens the new one. Editing the row in place here would
             erase exactly the history a pay dispute turns on. */
          const ok = await reviseSalary({
            employeeId: revising.employee,
            annualAmount: to,
            effectiveFrom: String(v.date),
            note: String(v.note || "Revision"),
          });
          if (!ok) return push("Couldn't revise that salary");

          setSalaries([...salarySeed]);
          setHistory([...historySeed]);
          push(`Salary revised to ${money(to)} for ${who}`);
        }}
        onClose={() => setRevising(null)}
      />

      {emailSlip && (
        <EmailComposeModal
          open
          onClose={() => setEmailSlip(null)}
          to={byId(emailSlip.employee)?.email ?? ""}
          subject={`Your payslip — ${emailSlip.period}`}
          body={`Hi ${byId(emailSlip.employee)?.name.split(" ")[0]},\n\nYour payslip for ${emailSlip.period} is attached.\n\nGross: ${money(emailSlip.gross)}\nDeductions: ${money(emailSlip.deductions)}\nNet pay: ${money(emailSlip.gross - emailSlip.deductions)}\n\nReach out to HR with any questions.\n\nWorksuite Payroll`}
          attachment={`payslip-${emailSlip.period.replace(" ", "-")}.pdf`}
        />
      )}

      {/* salary history */}
      <Modal open={historyFor !== null} onClose={() => setHistoryFor(null)} title={`Salary history — ${byId(historyFor?.employee)?.name ?? ""}`}>
        {historyFor && (
          <ul className="space-y-3 text-sm">
            {history.filter((h) => h.employee === historyFor.employee).length === 0 && (
              <li className="py-6 text-center text-faint">No revisions recorded yet.</li>
            )}
            {history
              .filter((h) => h.employee === historyFor.employee)
              .map((h) => (
                <li key={h.id} className="rounded-xl border border-line p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold tabular-nums">
                      {money(h.from)} → <span className="text-good">{money(h.to)}</span>
                    </span>
                    <span className="text-xs text-muted">{fmtDate(h.date)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{h.note} · {h.to >= h.from ? "+" : ""}{(((h.to - h.from) / h.from) * 100).toFixed(1)}%</p>
                </li>
              ))}
          </ul>
        )}
      </Modal>

    </>
  );
}
