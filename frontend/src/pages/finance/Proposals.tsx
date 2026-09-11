import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui";
import { clients } from "@/data/core";
import { leads } from "@/data/crm";
import { estimates, proposals } from "@/data/finance";
import { api } from "@/lib/api";
import { fmtDate, money, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function Proposals() {
  const { push } = useToast();
  const nav = useNavigate();
  const crud = useCrud({
    collection: "proposals",
    seed: proposals,
    itemName: "Proposal",
    onView: (p) => nav(`/finance/proposals/${p.id}`),
    makeId: (its) => `pr${its.length + 1}-${Date.now().toString(36)}`,
    fields: [
      { key: "number", label: "Proposal Number", required: true },
      { key: "leadName", label: "Lead / Company", type: "select", options: leads.map((l) => l.company) },
      { key: "total", label: "Total ($)", type: "number", required: true },
      { key: "date", label: "Date", type: "date" },
      { key: "valid", label: "Valid Till", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Sent", "Accepted", "Declined"] },
    ],
    defaults: { date: todayISO(), valid: "2026-09-28" } as never,
  });
  return (
    <>
      <PageHeader
        title="Proposals"
        crumbs={["Finance"]}
        actions={
          <button className="btn-primary" onClick={() => nav("/finance/proposals/new")}>
            <Plus size={15} /> Create Proposal
          </button>
        }
      />
      <FilterBar><DurationFilter /></FilterBar>
      <DataTable
        rows={crud.items}
        columns={[
          { key: "number", label: "Proposal", render: (p) => <span className="font-medium text-primary">{p.number}</span> },
          { key: "leadName", label: "Lead" },
          { key: "total", label: "Total", sort: (p) => p.total, render: (p) => money(p.total) },
          { key: "date", label: "Date", render: (p) => fmtDate(p.date) },
          { key: "valid", label: "Valid Till", render: (p) => fmtDate(p.valid) },
          { key: "status", label: "Status", render: (p) => <StatusPill status={p.status} /> },
        ]}
        rowActions={(p) =>
          crud.rowActions(p, [
            {
              label: "Convert to Estimate",
              onClick: () => {
                const est = {
                  id: `es-${Date.now()}`,
                  number: `EST#${String(estimates.length + 5).padStart(3, "0")}`,
                  // A proposal names a lead, not a client — carry the link across
                  // when one of them is already on the books.
                  clientId: clients.find((c) => c.company === p.leadName)?.id ?? "",
                  total: p.total,
                  valid: p.valid,
                  status: "Draft",
                  date: todayISO(),
                };
                estimates.push(est);
                void api.create("estimates", est);
                crud.update(p.id, { status: "Accepted" } as never, true);
                push(`${est.number} created from ${p.number}`);
              },
            },
          ])
        }
      />
      {crud.modals}
    </>
  );
}
