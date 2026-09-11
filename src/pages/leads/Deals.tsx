import clsx from "clsx";
import { Kanban as KanbanIcon, List, Plus } from "lucide-react";
import { useState } from "react";
import { ConvertDealModal } from "@/components/ConvertModals";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { Kanban } from "@/components/Kanban";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { Avatar, SearchInput, StatusPill } from "@/components/ui";
import { byId } from "@/data/core";
import { deals as seed, leads, pipelineStages } from "@/data/crm";
import { api } from "@/lib/api";
import { fmtDate, money } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function Deals() {
  const [view, setView] = useState<"list" | "board">("list");
  const [q, setQ] = useState("");
  const [winning, setWinning] = useState<(typeof seed)[number] | null>(null);
  const { push } = useToast();
  const crud = useCrud({
    collection: "deals",
    seed,
    itemName: "Deal",
    fields: [
      { key: "name", label: "Deal Name", required: true },
      { key: "leadId", label: "Lead Contact", type: "select", options: leads.map((l) => ({ value: l.id, label: `${l.name} (${l.company})` })) },
      { key: "value", label: "Deal Value ($)", type: "number", required: true },
      { key: "stage", label: "Stage", type: "select", options: pipelineStages.map((s) => ({ value: s.id, label: s.title })) },
      { key: "agent", label: "Deal Agent", type: "select", options: ["e3", "e7", "e10"].map((id) => ({ value: id, label: byId(id)?.name ?? id })) },
      { key: "close", label: "Expected Close Date", type: "date" },
      { key: "category", label: "Category", type: "select", options: ["Best Case", "Commit", "Pipeline", "Closed"] },
    ],
    defaults: { close: "2026-09-30" } as never,
  });
  const items = crud.items;
  const setStage = (id: string, stage: string) => crud.update(id, { stage } as never, true);
  const rows = items.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader
        title="Deals"
        crumbs={["Leads"]}
        actions={
          <>
            <button className="btn-primary" onClick={crud.openNew}>
              <Plus size={15} /> Add Deal
            </button>
            <div className="flex overflow-hidden rounded-md border border-line">
              <button className={clsx("btn px-3 py-2", view === "list" ? "bg-ink text-white" : "bg-white")} onClick={() => setView("list")} aria-label="List view">
                <List size={15} />
              </button>
              <button className={clsx("btn px-3 py-2", view === "board" ? "bg-ink text-white" : "bg-white")} onClick={() => setView("board")} aria-label="Board view">
                <KanbanIcon size={15} />
              </button>
            </div>
          </>
        }
      />
      <FilterBar>
        <DurationFilter />
        <span className="text-sm"><span className="text-muted">Pipeline</span> <b>Sales Pipeline</b></span>
        <SearchInput value={q} onChange={setQ} />
      </FilterBar>

      {view === "list" ? (
        <DataTable
          rows={rows}
          columns={[
            { key: "name", label: "Deal Name", sort: (d) => d.name, render: (d) => <span className="font-medium">{d.name}</span> },
            { key: "lead", label: "Lead", render: (d) => leads.find((l) => l.id === d.leadId)?.name },
            { key: "value", label: "Value", sort: (d) => d.value, render: (d) => money(d.value) },
            { key: "close", label: "Close Date", sort: (d) => d.close, render: (d) => fmtDate(d.close) },
            { key: "agent", label: "Agent", render: (d) => byId(d.agent)?.name },
            { key: "stage", label: "Stage", render: (d) => <StatusPill status={pipelineStages.find((s) => s.id === d.stage)?.title ?? d.stage} /> },
          ]}
        exportName="deals"
        onBulkDelete={crud.removeMany}
        bulkActions={[{ label: "Mark Won", onClick: (rs) => crud.updateMany(rs, { stage: "won" } as never, "won") }]}
          rowActions={(d) =>
            crud.rowActions(d, [
              ...(d.stage !== "won"
                ? [{ label: "Win deal → project", onClick: () => setWinning(d) }]
                : []),
            ])
          }
        />
      ) : (
        <Kanban
          columns={pipelineStages.map((s) => ({
            ...s,
            footer: money(items.filter((d) => d.stage === s.id).reduce((a, d) => a + d.value, 0)),
          }))}
          items={items}
          columnOf={(d) => d.stage}
          onMove={(id, col) => {
            setStage(id, col);
            push("Deal stage updated");
          }}
          renderCard={(d) => (
            <>
              <p className="text-sm font-semibold">{d.name}</p>
              <p className="mt-0.5 text-xs text-muted">{leads.find((l) => l.id === d.leadId)?.company}</p>
              <div className="mt-2.5 flex items-center justify-between">
                <span className="text-sm font-bold text-primary tabular-nums">{money(d.value)}</span>
                <Avatar name={byId(d.agent)?.name ?? "?"} size={24} />
              </div>
            </>
          )}
        />
      )}
      <ConvertDealModal deal={winning} onClose={() => setWinning(null)} />
      {crud.modals}
    </>
  );
}
