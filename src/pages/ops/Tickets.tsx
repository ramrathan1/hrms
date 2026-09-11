import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { AvatarName, SearchInput, Select, StatusPill } from "@/components/ui";
import { byId, clients, employees } from "@/data/core";
import { tickets } from "@/data/ops";
import { fmtDate, todayISO } from "@/lib/format";
import { CURRENT_USER, useToast } from "@/lib/store";

export default function Tickets() {
  const [status, setStatus] = useState("All");
  const [q, setQ] = useState("");
  const { push } = useToast();
  const nav = useNavigate();
  const crud = useCrud({
    collection: "tickets",
    seed: tickets,
    itemName: "Ticket",
    onView: (t) => nav(`/tickets/${t.id}`),
    makeId: (its) => `TKT#${String(its.length + 8).padStart(3, "0")}`,
    fields: [
      { key: "subject", label: "Subject", required: true, span: true },
      { key: "requester", label: "Requester", type: "select", options: clients.map((c) => c.name), required: true },
      { key: "agent", label: "Agent", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })) },
      { key: "priority", label: "Priority", type: "select", options: ["High", "Medium", "Low"] },
      { key: "group", label: "Assign Group", type: "select", options: ["Technical", "Billing", "Legal"] },
      { key: "type", label: "Type", type: "select", options: ["Question", "Problem", "Request"] },
      { key: "status", label: "Status", type: "select", options: ["Open", "Pending", "Resolved", "Closed"] },
    ],
    defaults: { updated: todayISO(), priority: "Medium", status: "Open" } as never,
  });
  const rows = crud.items.filter(
    (t) => (status === "All" || t.status === status) && (t.subject + t.id).toLowerCase().includes(q.toLowerCase())
  );
  return (
    <>
      <PageHeader
        title="Tickets"
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Create Ticket
          </button>
        }
      />
      <FilterBar>
        <DurationFilter />
        <Select label="Status" value={status} onChange={setStatus} options={["All", "Open", "Pending", "Resolved", "Closed"]} />
        <SearchInput value={q} onChange={setQ} />
      </FilterBar>
      <DataTable
        rows={rows}
        exportName="tickets"
        onBulkDelete={crud.removeMany}
        bulkActions={[
          { label: "Mark Resolved", onClick: (rs) => crud.updateMany(rs, { status: "Resolved" } as never, "resolved") },
          { label: "Set High Priority", onClick: (rs) => crud.updateMany(rs, { priority: "High" } as never, "escalated") },
          { label: "Assign to me", onClick: (rs) => crud.updateMany(rs, { agent: CURRENT_USER.id } as never, "assigned") },
        ]}
        columns={[
          { key: "id", label: "Ticket", render: (t) => (
            <button className="cursor-pointer font-medium text-primary hover:underline" onClick={() => nav(`/tickets/${t.id}`)}>
              {String(t.id)}
            </button>
          ) },
          { key: "subject", label: "Subject", sort: (t) => t.subject, render: (t) => (
            <button className="cursor-pointer text-left font-medium hover:text-primary" onClick={() => nav(`/tickets/${t.id}`)}>
              {t.subject}
            </button>
          ) },
          { key: "requester", label: "Requester" },
          { key: "agent", label: "Agent", render: (t) => <AvatarName name={byId(t.agent)?.name ?? "—"} size={26} /> },
          { key: "priority", label: "Priority", render: (t) => <StatusPill status={t.priority} /> },
          { key: "updated", label: "Last Activity", render: (t) => fmtDate(t.updated) },
          { key: "status", label: "Status", render: (t) => <StatusPill status={t.status} /> },
        ]}
        rowActions={(t) =>
          crud.rowActions(
            t,
            t.status === "Open" || t.status === "Pending"
              ? [{ label: "Mark Resolved", onClick: () => { crud.update(t.id, { status: "Resolved" } as never, true); push(`${t.id} resolved`); } }]
              : [{ label: "Reopen", onClick: () => crud.update(t.id, { status: "Open" } as never) }]
          )
        }
      />
      {crud.modals}
    </>
  );
}
