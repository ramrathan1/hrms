import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { FormModal, useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { AvatarName, Progress, StatusPill } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { keyResults, objectives } from "@/data/people2";
import { fmtDate } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function Objectives() {
  const { push } = useToast();
  const [checkin, setCheckin] = useState<(typeof objectives)[number] | null>(null);
  const crud = useCrud({
    collection: "objectives",
    seed: objectives,
    itemName: "Objective",
    fields: [
      { key: "title", label: "Objective Title", required: true, span: true },
      { key: "type", label: "Goal Type", type: "select", options: ["Individual", "Team", "Company"] },
      { key: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High"] },
      { key: "owner", label: "Owner (Assignee)", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })), required: true },
      { key: "start", label: "Start Date", type: "date" },
      { key: "end", label: "End Date", type: "date" },
      { key: "checkin", label: "Check-in Frequency", type: "select", options: ["Daily", "Weekly", "Monthly"] },
      { key: "progress", label: "Progress (%)", type: "number" },
    ],
    defaults: { start: "2026-09-01", end: "2026-12-31", progress: 0, priority: "Medium", checkin: "Weekly" } as never,
  });
  return (
    <>
      <PageHeader
        title="Objectives"
        crumbs={["Performance"]}
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Add Objective
          </button>
        }
      />
      <DataTable
        rows={crud.items}
        columns={[
          { key: "title", label: "Objective", sort: (o) => o.title, render: (o) => (
            <span>
              <span className="block font-medium">{o.title}</span>
              <span className="text-xs text-faint">{keyResults.filter((k) => k.objectiveId === o.id).length || "—"} key results</span>
            </span>
          ) },
          { key: "type", label: "Goal Type", render: (o) => <StatusPill status={o.type} tone="info" /> },
          { key: "owner", label: "Owner", render: (o) => <AvatarName name={byId(o.owner)?.name ?? "—"} size={26} /> },
          { key: "end", label: "End Date", sort: (o) => o.end, render: (o) => fmtDate(o.end) },
          { key: "priority", label: "Priority", render: (o) => <StatusPill status={o.priority} /> },
          { key: "progress", label: "Progress", sort: (o) => o.progress, render: (o) => <Progress value={o.progress} /> },
        ]}
        exportName="objectives"
        onBulkDelete={crud.removeMany}
        rowActions={(o) => crud.rowActions(o, [{ label: "Check-in", onClick: () => setCheckin(o) }])}
      />
      <FormModal
        open={checkin !== null}
        title={`Check-in — ${checkin?.title ?? ""}`}
        fields={[
          { key: "progress", label: "Current Progress (%)", type: "number", required: true },
          { key: "note", label: "What moved since last check-in?", type: "textarea" },
        ]}
        initial={checkin ? { progress: checkin.progress, note: "" } : null}
        submitLabel="Save Check-in"
        onSubmit={(v) => {
          if (checkin) {
            crud.update(checkin.id, { progress: Math.min(100, Number(v.progress)) } as never, true);
            push(`Progress updated to ${Math.min(100, Number(v.progress))}%`);
          }
          setCheckin(null);
        }}
        onClose={() => setCheckin(null)}
      />
      {crud.modals}
    </>
  );
}
