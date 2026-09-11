import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { FormModal, useCrud } from "@/components/crud";
import { FilterBar, PageHeader } from "@/components/PageHeader";
import { ActivityTimeline, type ActivityItem } from "@/components/RecordPanels";
import { AvatarName, Modal, Select, StatusPill } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { assets } from "@/data/ops";
import { api } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import { fmtDate, money, todayISO } from "@/lib/format";
import { CURRENT_USER, useToast } from "@/lib/store";

type Asset = (typeof assets)[number];

export default function Assets() {
  const { push } = useToast();
  const [assignFor, setAssignFor] = useState<Asset | null>(null);
  const [historyFor, setHistoryFor] = useState<Asset | null>(null);
  const [history, setHistory] = useState<Record<string, ActivityItem[]>>({});

  const logMovement = (assetId: string, text: string, status: string) => {
    const entry: ActivityItem = {
      id: `h-${Date.now()}`,
      by: CURRENT_USER.name,
      text,
      time: `29-08-2026 · now`,
    };
    setHistory((h) => ({ ...h, [assetId]: [...(h[assetId] ?? []), entry] }));
    void api.create("assetMovements", { assetId, text, status, by: CURRENT_USER.id, date: todayISO() });
  };
  const crud = useCrud({
    collection: "assets",
    seed: assets,
    itemName: "Asset",
    fields: [
      { key: "name", label: "Asset Name", required: true, span: true },
      { key: "type", label: "Type", type: "select", options: ["Laptop", "Monitor", "Phone", "Accessory"] },
      { key: "assignedTo", label: "Lend To", type: "select", options: [{ value: "", label: "— Unassigned —" }, ...employees.map((e) => ({ value: e.id, label: e.name }))] },
      { key: "value", label: "Value ($)", type: "number" },
      { key: "date", label: "Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Assigned", "Available"] },
    ],
    defaults: { date: todayISO(), status: "Available" } as never,
  });
  const filters = useFilters<Asset>([
    { label: "Type", options: ["All", "Laptop", "Monitor", "Phone", "Accessory"], match: (a, v) => a.type === v },
    { label: "Status", options: ["All", "Assigned", "Available"], match: (a, v) => a.status === v },
  ]);
  return (
    <>
      <PageHeader
        title="Assets"
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Add Asset
          </button>
        }
      />
      <FilterBar>
        {filters.controls.map((c) => <Select key={c.label} {...c} />)}
      </FilterBar>
      <DataTable
        rows={filters.apply(crud.items)}
        columns={[
          { key: "name", label: "Asset Name", sort: (a) => a.name, render: (a) => <span className="font-medium">{a.name}</span> },
          { key: "type", label: "Type" },
          { key: "assignedTo", label: "Lent To", render: (a) => (a.assignedTo ? <AvatarName name={byId(a.assignedTo)?.name ?? ""} size={26} /> : "--") },
          { key: "value", label: "Value", render: (a) => money(a.value) },
          { key: "date", label: "Date", render: (a) => fmtDate(a.date) },
          { key: "status", label: "Status", render: (a) => <StatusPill status={a.status} tone={a.status === "Assigned" ? "info" : "good"} /> },
        ]}
        exportName="assets"
        onBulkDelete={crud.removeMany}
        rowActions={(a) =>
          crud.rowActions(a, [
            { label: "Assignment history", onClick: () => setHistoryFor(a) },
            ...(a.assignedTo
              ? [{
                  label: "Return to inventory",
                  onClick: () => {
                    logMovement(a.id, `Returned by ${byId(a.assignedTo)?.name}`, "Available");
                    crud.update(a.id, { assignedTo: undefined, status: "Available" } as never, true);
                    push(`${a.name} returned to inventory`);
                  },
                }]
              : [{ label: "Assign to…", onClick: () => setAssignFor(a) }]),
          ])
        }
      />

      {/* assign */}
      <FormModal
        open={assignFor !== null}
        title={`Assign ${assignFor?.name ?? ""}`}
        fields={[
          { key: "assignedTo", label: "Assign to", type: "select", options: employees.map((e) => ({ value: e.id, label: `${e.name} — ${e.designation}` })), required: true },
          { key: "date", label: "Handover date", type: "date", required: true },
          { key: "note", label: "Condition / notes", type: "textarea", placeholder: "Charger included, minor scratch on lid…" },
        ]}
        initial={{ date: todayISO() }}
        submitLabel="Assign asset"
        onSubmit={(v) => {
          if (!assignFor) return;
          logMovement(assignFor.id, `Assigned to ${byId(String(v.assignedTo))?.name}${v.note ? ` — ${v.note}` : ""}`, "Assigned");
          crud.update(assignFor.id, { assignedTo: String(v.assignedTo), status: "Assigned" } as never, true);
          push(`${assignFor.name} assigned to ${byId(String(v.assignedTo))?.name}`);
          setAssignFor(null);
        }}
        onClose={() => setAssignFor(null)}
      />

      {/* history */}
      <Modal open={historyFor !== null} onClose={() => setHistoryFor(null)} title={`Assignment history — ${historyFor?.name ?? ""}`}>
        <ActivityTimeline
          items={(history[historyFor?.id ?? ""] ?? [
            { id: "seed", by: historyFor?.assignedTo ? byId(historyFor.assignedTo)?.name ?? "Admin" : "Admin", text: `received this asset on ${fmtDate(historyFor?.date ?? "2026-01-01")}`, time: fmtDate(historyFor?.date ?? "2026-01-01") },
          ]).slice().reverse()}
        />
      </Modal>
      {crud.modals}
    </>
  );
}
