import { Plus } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui";
import { clientById, clients } from "@/data/core";
import { creditNotes, invoices } from "@/data/finance";
import { fmtDate, money, todayISO } from "@/lib/format";

export default function CreditNotes() {
  const crud = useCrud({
    collection: "creditNotes",
    seed: creditNotes,
    itemName: "Credit Note",
    makeId: (its) => `cn-${its.length + 1}-${Date.now().toString(36)}`,
    fields: [
      { key: "number", label: "Credit Note Number", required: true },
      { key: "invoice", label: "Against Invoice", type: "select", options: invoices.map((i) => i.number) },
      { key: "clientId", label: "Client", type: "select", options: clients.map((c) => ({ value: c.id, label: c.company })) },
      { key: "total", label: "Total ($)", type: "number", required: true },
      { key: "used", label: "Used ($)", type: "number" },
      { key: "date", label: "Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Open", "Closed"] },
    ],
    defaults: { used: 0, date: todayISO(), status: "Open" } as never,
  });
  return (
    <>
      <PageHeader
        title="Credit Note"
        crumbs={["Finance"]}
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Add Credit Note
          </button>
        }
      />
      <FilterBar><DurationFilter /></FilterBar>
      <DataTable
        rows={crud.items}
        columns={[
          { key: "number", label: "Credit Note", render: (c) => <span className="font-medium text-primary">{c.number}</span> },
          { key: "invoice", label: "Invoice" },
          { key: "client", label: "Client", render: (c) => clientById(c.clientId)?.company },
          { key: "total", label: "Total", render: (c) => (
            <span className="text-xs leading-relaxed">
              <span className="block">Total: <b className="tabular-nums">{money(c.total)}</b></span>
              <span className="block text-warn">Used: {money(c.used)}</span>
              <span className="block text-bad">Remaining: {money(c.total - c.used)}</span>
            </span>
          ) },
          { key: "date", label: "Date", render: (c) => fmtDate(c.date) },
          { key: "status", label: "Status", render: (c) => <StatusPill status={c.status} /> },
        ]}
        exportName="credit-notes"
        onBulkDelete={crud.removeMany}
        rowActions={(c) => crud.rowActions(c)}
      />
      {crud.modals}
    </>
  );
}
