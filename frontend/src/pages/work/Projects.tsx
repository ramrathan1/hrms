import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { Avatar, Progress, SearchInput, Select, StatusPill } from "@/components/ui";
import { byId, clientById, clients } from "@/data/core";
import { projects } from "@/data/work";
import { fmtDate, todayISO } from "@/lib/format";
import { CURRENT_USER, useToast } from "@/lib/store";

export default function Projects() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const nav = useNavigate();
  const { push } = useToast();
  const crud = useCrud({
    collection: "projects",
    seed: projects,
    itemName: "Project",
    onView: (p) => nav(`/work/projects/${p.id}`),
    fields: [
      { key: "name", label: "Project Name", required: true },
      { key: "code", label: "Short Code", required: true },
      { key: "clientId", label: "Client", type: "select", options: clients.map((c) => ({ value: c.id, label: c.company })) },
      { key: "deadline", label: "Deadline", type: "date" },
      { key: "budget", label: "Budget ($)", type: "number" },
      { key: "progress", label: "Progress (%)", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Not Started", "In Progress", "On Hold", "Completed"] },
      { key: "category", label: "Category", type: "select", options: ["Web", "Platform", "Service"] },
    ],
    defaults: { start: todayISO(), members: [CURRENT_USER.id], progress: 0 } as never,
  });
  const rows = crud.items.filter(
    (p) => (status === "All" || p.status === status) && p.name.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <>
      <PageHeader
        title="Projects"
        crumbs={["Work"]}
        actions={
          <Link to="/work/projects/new" className="btn-primary">
            <Plus size={15} /> Add Project
          </Link>
        }
      />
      <FilterBar>
        <DurationFilter />
        <Select label="Status" value={status} onChange={setStatus} options={["All", "In Progress", "On Hold", "Not Started", "Completed"]} />
        <SearchInput value={q} onChange={setQ} />
      </FilterBar>
      <DataTable
        rows={rows}
        columns={[
          { key: "code", label: "Code", sort: (p) => p.code },
          { key: "name", label: "Project Name", sort: (p) => p.name, render: (p) => (
            <Link to={`/work/projects/${p.id}`} className="font-medium text-ink hover:text-primary">{p.name}</Link>
          ) },
          { key: "members", label: "Members", render: (p) => (
            <span className="flex -space-x-1.5">{p.members.map((m) => <Avatar key={m} name={byId(m)?.name ?? m} size={26} />)}</span>
          ) },
          { key: "deadline", label: "Deadline", sort: (p) => p.deadline, render: (p) => fmtDate(p.deadline) },
          { key: "client", label: "Client", render: (p) => clientById(p.clientId)?.company },
          { key: "progress", label: "Progress", sort: (p) => p.progress, render: (p) => <Progress value={p.progress} /> },
          { key: "status", label: "Status", render: (p) => <StatusPill status={p.status} /> },
        ]}
        exportName="projects"
        onBulkDelete={crud.removeMany}
        bulkActions={[{ label: "Mark Completed", onClick: (rs) => crud.updateMany(rs, { status: "Completed" } as never, "completed") }]}
        rowActions={(p) =>
          crud.rowActions(p, [
            { label: "Archive", onClick: () => { crud.update(p.id, { status: "On Hold" } as never, true); push(`${p.code} archived (moved to On Hold)`); } },
          ])
        }
      />
      {crud.modals}
    </>
  );
}
