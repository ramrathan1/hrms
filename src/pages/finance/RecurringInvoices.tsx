/* Recurring invoice profiles: subscriptions/retainers that generate invoices
   on a schedule. Run now, pause/resume, and see what's due next. */
import { PlayCircle, Plus, Repeat, Zap } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { AvatarName, StatusPill } from "@/components/ui";
import { clientById, clients } from "@/data/core";
import { invoices, recurringInvoices } from "@/data/finance";
import { api } from "@/lib/api";
import { addDays, fmtDate, iso, money, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

const CYCLE_DAYS: Record<string, number> = { Weekly: 7, Monthly: 30, Quarterly: 91, Yearly: 365 };

export default function RecurringInvoices() {
  const { push } = useToast();
  const crud = useCrud({
    collection: "recurringInvoices",
    seed: recurringInvoices,
    itemName: "Recurring invoice",
    fields: [
      { key: "clientId", label: "Client", type: "select", options: clients.map((c) => ({ value: c.id, label: c.company })), required: true },
      { key: "memo", label: "Description", required: true, span: true, placeholder: "e.g. Monthly retainer — support & maintenance" },
      { key: "amount", label: "Amount ($)", type: "number", required: true },
      { key: "cycle", label: "Billing cycle", type: "select", options: ["Weekly", "Monthly", "Quarterly", "Yearly"] },
      { key: "nextRun", label: "Next invoice date", type: "date", required: true },
      { key: "status", label: "Status", type: "select", options: ["Active", "Paused"] },
    ],
    defaults: { nextRun: "2026-09-01", startedOn: todayISO(), issued: 0, status: "Active", cycle: "Monthly" } as never,
  });

  const active = crud.items.filter((r) => r.status === "Active");
  const mrr = active.reduce((a, r) => a + r.amount * (30 / (CYCLE_DAYS[r.cycle] ?? 30)), 0);

  const runNow = (r: (typeof recurringInvoices)[number]) => {
    const inv = {
      id: `inv-${Date.now().toString(36)}`,
      number: `INV#${String(invoices.length + 20).padStart(3, "0")}`,
      clientId: r.clientId,
      total: r.amount,
      paid: 0,
      date: todayISO(),
      due: iso(addDays(new Date(2026, 7, 29), 15)),
      status: "Unpaid" as const,
    };
    invoices.push(inv);
    void api.create("invoices", inv);
    const next = iso(addDays(new Date(r.nextRun + "T00:00:00"), CYCLE_DAYS[r.cycle] ?? 30));
    crud.update(r.id, { issued: r.issued + 1, nextRun: next } as never, true);
    push(`${inv.number} generated for ${clientById(r.clientId)?.company} — next run ${fmtDate(next)}`);
  };

  return (
    <>
      <PageHeader
        title="Recurring Invoices"
        crumbs={["Finance"]}
        actions={
          <>
            <button className="btn-primary" onClick={crud.openNew}>
              <Plus size={15} /> New recurring invoice
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                const due = active.filter((r) => r.nextRun <= "2026-09-01");
                if (due.length === 0) return push("Nothing due to run yet");
                due.forEach(runNow);
              }}
            >
              <Zap size={15} /> Run all due
            </button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active profiles" value={active.length} icon={Repeat} sub={`${crud.items.length - active.length} paused`} />
        <StatCard label="Monthly recurring revenue" value={money(Math.round(mrr))} sub="normalised across cycles" />
        <StatCard label="Invoices generated" value={crud.items.reduce((a, r) => a + r.issued, 0)} sub="all time" />
        <StatCard label="Next run" value={active.length ? fmtDate(active.map((r) => r.nextRun).sort()[0]) : "—"} />
      </div>

      <DataTable
        rows={crud.items}
        exportName="recurring-invoices"
        onBulkDelete={crud.removeMany}
        bulkActions={[
          { label: "Pause", onClick: (rs) => crud.updateMany(rs, { status: "Paused" } as never, "paused") },
          { label: "Resume", onClick: (rs) => crud.updateMany(rs, { status: "Active" } as never, "resumed") },
        ]}
        columns={[
          { key: "client", label: "Client", render: (r) => <AvatarName name={clientById(r.clientId)?.name ?? "—"} sub={clientById(r.clientId)?.company} size={28} /> },
          { key: "memo", label: "Description", sort: (r) => r.memo, render: (r) => <span className="font-medium">{r.memo}</span> },
          { key: "amount", label: "Amount", sort: (r) => r.amount, render: (r) => <span className="font-medium tabular-nums">{money(r.amount)}</span> },
          { key: "cycle", label: "Cycle", render: (r) => <StatusPill status={r.cycle} tone="info" /> },
          { key: "nextRun", label: "Next invoice", sort: (r) => r.nextRun, render: (r) => fmtDate(r.nextRun) },
          { key: "issued", label: "Issued", className: "tabular-nums" },
          { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
        ]}
        rowActions={(r) =>
          crud.rowActions(r, [
            { label: "Generate invoice now", onClick: () => runNow(r) },
            {
              label: r.status === "Active" ? "Pause schedule" : "Resume schedule",
              onClick: () => crud.update(r.id, { status: r.status === "Active" ? "Paused" : "Active" } as never),
            },
          ])
        }
        emptyText="No recurring invoices — set up a retainer or subscription"
      />

      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-faint">
        <PlayCircle size={13} /> Profiles generate a real invoice on their next run date and roll the schedule forward.
      </p>
      {crud.modals}
    </>
  );
}
