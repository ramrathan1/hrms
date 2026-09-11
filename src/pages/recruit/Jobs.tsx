import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { AvatarName, StatusPill } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { jobs } from "@/data/recruit";
import { fmtDate } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function Jobs() {
  const { push } = useToast();
  const nav = useNavigate();
  const crud = useCrud({
    collection: "jobs",
    seed: jobs,
    itemName: "Job",
    fields: [
      { key: "title", label: "Job Title", required: true, span: true },
      { key: "recruiter", label: "Recruiter", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })) },
      { key: "openings", label: "Total Openings", type: "number", required: true },
      { key: "type", label: "Job Type", type: "select", options: ["Full Time", "Part Time", "Contract", "Intern"] },
      { key: "location", label: "Location", placeholder: "Remote / Worksuite HQ" },
      { key: "start", label: "Start Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Open", "Closed"] },
    ],
    defaults: { start: "2026-09-01", end: "No End Date", status: "Open", recruiter: "e10" } as never,
  });
  return (
    <>
      <PageHeader
        title="Jobs"
        crumbs={["Recruit"]}
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Add Job
          </button>
        }
      />
      <FilterBar><DurationFilter /></FilterBar>
      <DataTable
        rows={crud.items}
        columns={[
          { key: "title", label: "Job Title", sort: (j) => j.title, render: (j) => <span className="font-medium">{j.title}</span> },
          { key: "recruiter", label: "Recruiter", render: (j) => <AvatarName name={byId(j.recruiter)?.name ?? "—"} sub={byId(j.recruiter)?.designation} size={28} /> },
          { key: "openings", label: "Openings", className: "tabular-nums" },
          { key: "type", label: "Type" },
          { key: "start", label: "Start Date", render: (j) => fmtDate(j.start) },
          { key: "end", label: "End Date", render: (j) => (j.end === "No End Date" ? j.end : fmtDate(j.end)) },
          { key: "status", label: "Status", render: (j) => <StatusPill status={j.status} /> },
        ]}
        exportName="jobs"
        onBulkDelete={crud.removeMany}
        bulkActions={[{ label: "Close jobs", onClick: (rs) => crud.updateMany(rs, { status: "Closed" } as never, "closed") }]}
        rowActions={(j) =>
          crud.rowActions(j, [
            { label: "View Applications", onClick: () => nav("/recruit/applications") },
            ...(j.status === "Open"
              ? [{ label: "Close Job", onClick: () => { crud.update(j.id, { status: "Closed" } as never, true); push(`"${j.title}" closed`); } }]
              : [{ label: "Reopen Job", onClick: () => crud.update(j.id, { status: "Open" } as never) }]),
          ])
        }
      />
      {crud.modals}
    </>
  );
}
