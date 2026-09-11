import clsx from "clsx";
import { Kanban as KanbanIcon, List, Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { Kanban } from "@/components/Kanban";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { AvatarName, SearchInput, Select, StatusPill } from "@/components/ui";
import { applications as seed, interviews, jobs } from "@/data/recruit";
import { api } from "@/lib/api";
import { fmtDate, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

const COLS = [
  { id: "Applied", title: "Applied", color: "#8b94a7" },
  { id: "Phone Screen", title: "Phone Screen", color: "#e8983c" },
  { id: "Interview", title: "Interview", color: "#3fa9f5" },
  { id: "Hired", title: "Hired", color: "#1fa971" },
  { id: "Rejected", title: "Rejected", color: "#e85d51" },
];

export default function Applications() {
  const [view, setView] = useState<"list" | "board">("list");
  const [q, setQ] = useState("");
  const [job, setJob] = useState("All");
  const { push } = useToast();
  const crud = useCrud({
    collection: "applications",
    seed,
    itemName: "Job Application",
    fields: [
      { key: "name", label: "Candidate Name", required: true },
      { key: "email", label: "Email", required: true },
      { key: "jobId", label: "Job", type: "select", options: jobs.map((j) => ({ value: j.id, label: j.title })) },
      { key: "location", label: "Job Location" },
      { key: "date", label: "Applied On", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Applied", "Phone Screen", "Interview", "Offer", "Hired", "Rejected"] },
    ],
    defaults: { date: todayISO(), status: "Applied", location: "Worksuite" } as never,
  });
  const items = crud.items;
  const rows = items.filter(
    (a) =>
      (job === "All" || jobs.find((j) => j.id === a.jobId)?.title === job) &&
      a.name.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <>
      <PageHeader
        title="Job Applications"
        crumbs={["Recruit"]}
        actions={
          <>
            <button className="btn-primary" onClick={crud.openNew}>
              <Plus size={15} /> Add Job Application
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
        <Select label="Job" value={job} onChange={setJob} options={["All", ...jobs.map((j) => j.title)]} />
        <SearchInput value={q} onChange={setQ} />
      </FilterBar>

      {view === "list" ? (
        <DataTable
          rows={rows}
          columns={[
            { key: "name", label: "Name", sort: (a) => a.name, render: (a) => <AvatarName name={a.name} sub={a.email} /> },
            { key: "job", label: "Jobs", render: (a) => jobs.find((j) => j.id === a.jobId)?.title },
            { key: "location", label: "Job Location" },
            { key: "date", label: "Date", sort: (a) => a.date, render: (a) => fmtDate(a.date) },
            { key: "status", label: "Status", render: (a) => <StatusPill status={a.status} /> },
          ]}
        exportName="job-applications"
        onBulkDelete={crud.removeMany}
        bulkActions={[{ label: "Move to Interview", onClick: (rs) => crud.updateMany(rs, { status: "Interview" } as never, "moved") }, { label: "Reject", danger: true, onClick: (rs) => crud.updateMany(rs, { status: "Rejected" } as never, "rejected") }]}
          rowActions={(a) =>
            crud.rowActions(a, [
              {
                label: "Schedule Interview",
                onClick: () => {
                  const iv = { id: `iv-${Date.now()}`, candidate: a.name, job: jobs.find((j) => j.id === a.jobId)?.title ?? "—", date: "2026-09-01", time: "11:00 am", status: "Pending" };
                  interviews.push(iv);
                  void api.create("interviews", iv);
                  crud.update(a.id, { status: "Interview" } as never, true);
                  push(`Interview scheduled for ${a.name} — see Interview Schedule`);
                },
              },
              ...(a.status !== "Rejected"
                ? [{ label: "Reject", danger: true, onClick: () => { crud.update(a.id, { status: "Rejected" } as never, true); push(`${a.name} rejected`); } }]
                : []),
            ])
          }
        />
      ) : (
        <Kanban
          columns={COLS}
          items={rows}
          columnOf={(a) => a.status}
          onMove={(id, col) => {
            crud.update(id, { status: col } as never, true);
            push("Application status updated");
          }}
          renderCard={(a) => (
            <>
              <AvatarName name={a.name} sub={jobs.find((j) => j.id === a.jobId)?.title} size={30} />
              <p className="mt-2 text-xs text-muted">{fmtDate(a.date)}</p>
            </>
          )}
        />
      )}
      {crud.modals}
    </>
  );
}
