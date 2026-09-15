import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { peopleOptions } from "@/lib/people";
import { useCrud } from "@/components/crud";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { AvatarName, SearchInput, Select, StatusPill } from "@/components/ui";
import { byId, clients, employees } from "@/data/core";
import { tickets } from "@/data/ops";
import { fmtDate, todayISO } from "@/lib/format";
import { CURRENT_USER, useToast } from "@/lib/store";
import { can } from "@/lib/api";

export default function Tickets() {
  const [status, setStatus] = useState("All");
  const [q, setQ] = useState("");
  const { push } = useToast();

  /* Who may act as the support desk. Running the queue — logging a ticket for
     somebody else, assigning an agent, setting a status — carries
     tickets:update. Everyone else raises tickets about their own problems. */
  const mayManage = can("tickets:update");
  const myName = byId(CURRENT_USER.id)?.name ?? CURRENT_USER.name;
  const nav = useNavigate();
  const crud = useCrud({
    collection: "tickets",
    seed: tickets,
    itemName: "Ticket",
    onView: (t) => nav(`/tickets/${t.id}`),
    makeId: (its) => `TKT#${String(its.length + 8).padStart(3, "0")}`,
    fields: [
      { key: "subject", label: "Subject", required: true, span: true },
      { key: "body", label: "What happened?", type: "textarea", span: true, placeholder: "Anything that helps whoever picks this up" },
      /* Requester is who reported it — a client for a customer ticket, a
         colleague for an internal one. It used to be a required list of
         clients, so with no clients on file nobody could raise a ticket at
         all. You raise your own; the desk may raise one for anyone. */
      ...(mayManage
        ? [{
            key: "requester",
            label: "Requester",
            type: "select" as const,
            options: [...clients.map((c) => c.name), ...employees.map((e) => e.name)],
          }]
        : []),
      // The agent is who will work the ticket. The desk assigns it; leaving it
      // unset means "unassigned", which is the honest state for a new report.
      ...(mayManage
        ? [{ key: "agent", label: "Agent", type: "select" as const, options: peopleOptions("tickets:update") }]
        : []),
      { key: "priority", label: "Priority", type: "select", options: ["High", "Medium", "Low"] },
      { key: "group", label: "Assign Group", type: "select", options: ["Technical", "Billing", "Legal"] },
      { key: "type", label: "Type", type: "select", options: ["Question", "Problem", "Request"] },
      ...(mayManage
        ? [{ key: "status", label: "Status", type: "select" as const, options: ["Open", "Pending", "Resolved", "Closed"] }]
        : []),
    ],
    // A ticket you raise is about you, and it starts Open.
    defaults: { updated: todayISO(), priority: "Medium", status: "Open", requester: myName } as never,
  });
  const rows = crud.items.filter(
    (t) => (status === "All" || t.status === status) && (t.subject + t.number).toLowerCase().includes(q.toLowerCase())
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
          { key: "number", label: "Ticket", render: (t) => (
            <button className="cursor-pointer font-medium text-primary hover:underline" onClick={() => nav(`/tickets/${t.id}`)}>
              {t.number}
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
              ? [{ label: "Mark Resolved", onClick: () => { crud.update(t.id, { status: "Resolved" } as never, true); push(`${t.number} resolved`); } }]
              : [{ label: "Reopen", onClick: () => crud.update(t.id, { status: "Open" } as never) }]
          )
        }
      />
      {crud.modals}
    </>
  );
}
