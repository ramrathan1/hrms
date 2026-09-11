import { useState } from "react";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Avatar, StatusPill, Tabs, EmptyState } from "@/components/ui";
import { byId } from "@/data/core";
import { deals, leadEmails, leadNotes, leads, pipelineStages } from "@/data/crm";
import { fmtDate, money } from "@/lib/format";

export default function LeadDetail() {
  const { id } = useParams();
  /* Non-null by construction: the route wraps this page in RequireRecord,
     which only renders it once the record is in the store. */
  const lead = leads.find((l) => l.id === id)!;
  const [tab, setTab] = useState("Profile");
  const myDeals = deals.filter((d) => d.leadId === lead.id);
  return (
    <>
      <PageHeader title={lead.name} crumbs={["Leads", "Lead Contacts"]} />
      <div className="card mb-5 flex items-center gap-4 px-6 py-5">
        <Avatar name={lead.name} size={56} />
        <div>
          <h2 className="text-lg font-bold">{lead.name}</h2>
          <p className="text-sm text-muted">{lead.company} · Source: {lead.source}</p>
        </div>
        <span className="ml-auto text-sm text-muted">Owner: {byId(lead.owner)?.name}</span>
      </div>
      <div className="card mb-5 px-2">
        <Tabs tabs={["Profile", "Deals", "Notes", "Emails"]} active={tab} onChange={setTab} className="border-b-0" />
      </div>

      {tab === "Profile" && (
        <div className="card p-6">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm md:grid-cols-2">
            {[
              ["Name", lead.name],
              ["Company", lead.company],
              ["Email", lead.email],
              ["Phone", lead.phone],
              ["Lead Source", lead.source],
              ["Created", fmtDate(lead.added)],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-6 border-b border-line pb-3">
                <dt className="w-36 shrink-0 text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {tab === "Deals" && (
        <DataTable
          rows={myDeals}
          selectable={false}
          columns={[
            { key: "name", label: "Deal Name", render: (d) => <span className="font-medium">{d.name}</span> },
            { key: "value", label: "Deal Value", sort: (d) => d.value, render: (d) => money(d.value) },
            { key: "stage", label: "Stage", render: (d) => <StatusPill status={pipelineStages.find((s) => s.id === d.stage)?.title ?? d.stage} /> },
            { key: "close", label: "Close Date", render: (d) => fmtDate(d.close) },
            { key: "agent", label: "Deal Agent", render: (d) => byId(d.agent)?.name },
          ]}
          emptyText="No deals for this contact yet"
        />
      )}

      {tab === "Notes" && (
        <div className="space-y-4">
          {leadNotes.filter((n) => n.leadId === lead.id).map((n) => (
            <div key={n.id} className="card px-5 py-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{n.title}</h3>
                <span className="text-xs text-muted">{fmtDate(n.date)}</span>
              </div>
              <p className="mt-1.5 text-sm text-muted">{n.body}</p>
            </div>
          ))}
          {leadNotes.filter((n) => n.leadId === lead.id).length === 0 && <div className="card"><EmptyState /></div>}
        </div>
      )}

      {tab === "Emails" && (
        <DataTable
          rows={leadEmails.filter((m) => m.leadId === lead.id)}
          selectable={false}
          columns={[
            { key: "subject", label: "Subject", render: (m) => <span className="font-medium">{m.subject}</span> },
            { key: "to", label: "To" },
            { key: "date", label: "Sent", render: (m) => fmtDate(m.date) },
          ]}
          emptyText="No emails logged"
        />
      )}
    </>
  );
}
