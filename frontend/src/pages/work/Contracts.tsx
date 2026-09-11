import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui";
import { clientById, clients } from "@/data/core";
import { contracts } from "@/data/work";
import { fmtDate, money } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function Contracts() {
  const nav = useNavigate();
  const { push } = useToast();
  const crud = useCrud({
    collection: "contracts",
    seed: contracts,
    itemName: "Contract",
    onView: (c) => nav(`/work/contracts/${c.id}`),
    makeId: (items) => `ct${items.length + 1}-${Date.now().toString(36)}`,
    fields: [
      { key: "subject", label: "Contract Subject", required: true },
      { key: "clientId", label: "Client", type: "select", options: clients.map((c) => ({ value: c.id, label: c.company })), required: true },
      { key: "amount", label: "Contract Value ($)", type: "number", required: true },
      { key: "start", label: "Start Date", type: "date" },
      { key: "end", label: "End Date", type: "date" },
      { key: "type", label: "Contract Type", type: "select", options: ["Development", "Support", "Retainer"] },
    ],
    defaults: { start: "2026-09-01", end: "2027-08-31", signed: false, number: "" } as never,
  });
  return (
    <>
      <PageHeader
        title="Contracts"
        crumbs={["Work"]}
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Add Contract
          </button>
        }
      />
      <FilterBar>
        <DurationFilter />
        <span className="text-sm"><span className="text-muted">Type</span> <b>All</b></span>
      </FilterBar>
      <DataTable
        rows={crud.items}
        columns={[
          { key: "number", label: "Contract Number", render: (c) => <Link to={`/work/contracts/${c.id}`} className="font-medium text-primary">{c.number || `CONTRACT#${String(c.id).slice(-4).toUpperCase()}`}</Link> },
          { key: "subject", label: "Subject", render: (c) => <span className="font-medium">{c.subject}</span> },
          { key: "client", label: "Client", render: (c) => clientById(c.clientId)?.name },
          { key: "amount", label: "Amount", sort: (c) => c.amount, render: (c) => money(c.amount) },
          { key: "start", label: "Start Date", render: (c) => fmtDate(c.start) },
          { key: "end", label: "End Date", render: (c) => fmtDate(c.end) },
          { key: "signed", label: "Signature", render: (c) => <StatusPill status={c.signed ? "Signed" : "Pending"} /> },
        ]}
        exportName="contracts"
        onBulkDelete={crud.removeMany}
        rowActions={(c) =>
          crud.rowActions(c, [
            ...(!c.signed
              ? [{ label: "Mark Signed", onClick: () => { crud.update(c.id, { signed: true } as never, true); push("Contract marked as signed"); } }]
              : []),
          ])
        }
      />
      {crud.modals}
    </>
  );
}
