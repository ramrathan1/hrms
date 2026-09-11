import { ExternalLink, FileText, UserPlus } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EmailComposeModal } from "@/components/EmailComposeModal";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Avatar, AvatarName, EmptyState, Progress, StatusPill, Tabs } from "@/components/ui";
import { clientById, clientContacts, clients } from "@/data/core";
import { creditNotes, estimates, invoices, payments } from "@/data/finance";
import { projects } from "@/data/work";
import { tickets } from "@/data/ops";
import { fmtDate, money } from "@/lib/format";

const TABS = ["Profile", "Statement", "Projects", "Invoices", "Estimates", "Credit Note", "Payments", "Contacts", "Documents", "Notes", "Tickets"];

export default function ClientDetail() {
  const { id } = useParams();
  /* Non-null by construction: the route wraps this page in RequireRecord,
     which only renders it once the record is in the store. */
  const client = clientById(id)!;
  const [tab, setTab] = useState("Profile");
  const nav = useNavigate();
  const [statementOpen, setStatementOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const cProjects = projects.filter((p) => p.clientId === client.id);
  const cInvoices = invoices.filter((i) => i.clientId === client.id);
  /* statement of account: invoices as debits, payments as credits, running balance */
  const ledger = [
    ...cInvoices.map((i) => ({ id: `i-${i.id}`, date: i.date, ref: i.number, kind: "Invoice", debit: i.total, credit: 0 })),
    ...payments
      .filter((p) => cInvoices.some((i) => i.id === p.invoiceId))
      .map((p) => ({ id: `p-${p.id}`, date: p.date, ref: invoices.find((i) => i.id === p.invoiceId)?.number ?? "Payment", kind: "Payment", debit: 0, credit: p.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  const ledgerRows = ledger.map((l) => {
    running += l.debit - l.credit;
    return { ...l, balance: running };
  });
  const outstanding = running;

  return (
    <>
      <PageHeader
        title={client.name}
        crumbs={["Clients"]}
        actions={
          <>
            <button className="btn-outline" onClick={() => setStatementOpen(true)}>
              <FileText size={15} /> Email statement
            </button>
            <button className="btn-outline" onClick={() => nav(`/portal/${client.id}`)}>
              <ExternalLink size={15} /> View portal
            </button>
            <button className="btn-primary" onClick={() => setPortalOpen(true)}>
              <UserPlus size={15} /> Invite to portal
            </button>
          </>
        }
      />
      <div className="card mb-5 flex flex-wrap items-center gap-5 px-6 py-5">
        <Avatar name={client.name} size={60} />
        <div>
          <h2 className="text-lg font-bold">{client.name}</h2>
          <p className="text-sm text-muted">{client.company}</p>
        </div>
        <div className="ml-auto grid grid-cols-3 gap-8 text-center text-sm">
          <div><p className="text-lg font-bold text-primary tabular-nums">{cProjects.length}</p><p className="text-muted">Projects</p></div>
          <div><p className="text-lg font-bold text-primary tabular-nums">{money(cInvoices.reduce((a, i) => a + i.paid, 0))}</p><p className="text-muted">Earnings</p></div>
          <div><p className="text-lg font-bold text-primary tabular-nums">{money(cInvoices.reduce((a, i) => a + (i.total - i.paid), 0))}</p><p className="text-muted">Due</p></div>
        </div>
      </div>
      <div className="card mb-5 px-2">
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="border-b-0" />
      </div>

      {tab === "Profile" && (
        <div className="card p-6">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm md:grid-cols-2">
            {[
              ["Full Name", client.name],
              ["Email", client.email],
              ["Company Name", client.company],
              ["Mobile", client.phone],
              ["Category", client.category],
              ["Status", client.status],
              ["Created", fmtDate(client.added)],
              ["Language", "English"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-6 border-b border-line pb-3">
                <dt className="w-36 shrink-0 text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {tab === "Statement" && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card px-5 py-4">
              <p className="text-[13px] font-semibold text-muted">Total invoiced</p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums">{money(cInvoices.reduce((a, i) => a + i.total, 0))}</p>
            </div>
            <div className="card px-5 py-4">
              <p className="text-[13px] font-semibold text-muted">Total received</p>
              <p className="mt-1 font-display text-xl font-bold text-good tabular-nums">{money(cInvoices.reduce((a, i) => a + i.paid, 0))}</p>
            </div>
            <div className="card px-5 py-4">
              <p className="text-[13px] font-semibold text-muted">Outstanding balance</p>
              <p className={`mt-1 font-display text-xl font-bold tabular-nums ${outstanding > 0 ? "text-bad" : "text-good"}`}>{money(outstanding)}</p>
            </div>
          </div>
          <DataTable
            rows={ledgerRows}
            selectable={false}
            exportName={`${client.company}-statement`}
            columns={[
              { key: "date", label: "Date", sort: (r) => r.date, render: (r) => fmtDate(r.date) },
              { key: "ref", label: "Reference", render: (r) => <span className="font-medium">{r.ref}</span> },
              { key: "kind", label: "Type", render: (r) => <StatusPill status={r.kind} tone={r.kind === "Payment" ? "good" : "info"} /> },
              { key: "debit", label: "Debit", render: (r) => (r.debit ? money(r.debit) : "—"), className: "tabular-nums" },
              { key: "credit", label: "Credit", render: (r) => (r.credit ? <span className="text-good">{money(r.credit)}</span> : "—"), className: "tabular-nums" },
              { key: "balance", label: "Balance", render: (r) => <span className="font-semibold tabular-nums">{money(r.balance)}</span> },
            ]}
            emptyText="No transactions with this client yet"
          />
        </>
      )}

      {tab === "Projects" && (
        <DataTable
          rows={cProjects}
          selectable={false}
          columns={[
            { key: "name", label: "Project Name", render: (p) => <span className="font-medium">{p.name}</span> },
            { key: "members", label: "Members", render: (p) => <span className="flex -space-x-1.5">{p.members.map((m) => <Avatar key={m} name={m} size={26} />)}</span> },
            { key: "deadline", label: "Deadline", render: (p) => fmtDate(p.deadline) },
            { key: "progress", label: "Progress", render: (p) => <Progress value={p.progress} /> },
            { key: "status", label: "Status", render: (p) => <StatusPill status={p.status} /> },
          ]}
          emptyText="No projects for this client"
        />
      )}

      {tab === "Invoices" && (
        <DataTable
          rows={cInvoices}
          selectable={false}
          columns={[
            { key: "number", label: "Invoice", render: (i) => <span className="font-medium">{i.number}</span> },
            { key: "total", label: "Total", sort: (i) => i.total, render: (i) => money(i.total) },
            { key: "date", label: "Invoice Date", render: (i) => fmtDate(i.date) },
            { key: "status", label: "Status", render: (i) => <StatusPill status={i.status} /> },
          ]}
          emptyText="No invoices yet"
        />
      )}

      {tab === "Estimates" && (
        <DataTable
          rows={estimates.filter((e) => e.clientId === client.id)}
          selectable={false}
          columns={[
            { key: "number", label: "Estimate", render: (e) => <span className="font-medium">{e.number}</span> },
            { key: "total", label: "Total", render: (e) => money(e.total) },
            { key: "valid", label: "Valid Till", render: (e) => fmtDate(e.valid) },
            { key: "status", label: "Status", render: (e) => <StatusPill status={e.status} /> },
          ]}
          emptyText="No estimates yet"
        />
      )}

      {tab === "Credit Note" && (
        <DataTable
          rows={creditNotes.filter((c) => c.clientId === client.id)}
          selectable={false}
          columns={[
            { key: "number", label: "Credit Note", render: (c) => c.number },
            { key: "invoice", label: "Invoice" },
            { key: "total", label: "Total", render: (c) => money(c.total) },
            { key: "status", label: "Status", render: (c) => <StatusPill status={c.status} /> },
          ]}
          emptyText="No credit notes"
        />
      )}

      {tab === "Payments" && (
        <DataTable
          rows={payments.filter((p) => cInvoices.some((i) => i.id === p.invoiceId))}
          selectable={false}
          columns={[
            { key: "invoiceId", label: "Invoice", render: (p) => invoices.find((i) => i.id === p.invoiceId)?.number },
            { key: "amount", label: "Amount", render: (p) => money(p.amount) },
            { key: "gateway", label: "Gateway" },
            { key: "date", label: "Paid On", render: (p) => fmtDate(p.date) },
          ]}
          emptyText="No payments received"
        />
      )}

      {tab === "Contacts" && (
        <DataTable
          rows={clientContacts.filter((c) => c.clientId === client.id)}
          selectable={false}
          columns={[
            { key: "name", label: "Name", render: (c) => <AvatarName name={c.name} sub={c.title} /> },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
          ]}
          emptyText="No contacts added"
        />
      )}

      {tab === "Documents" && <div className="card"><EmptyState text="No documents uploaded" /></div>}
      {tab === "Notes" && <div className="card"><EmptyState text="No notes yet" /></div>}

      {tab === "Tickets" && (
        <DataTable
          rows={tickets.filter((t) => t.requester === client.name)}
          selectable={false}
          columns={[
            { key: "id", label: "Ticket", render: (t) => <span className="font-medium">{t.id}</span> },
            { key: "subject", label: "Subject" },
            { key: "priority", label: "Priority", render: (t) => <StatusPill status={t.priority} /> },
            { key: "status", label: "Status", render: (t) => <StatusPill status={t.status} /> },
          ]}
          emptyText="No tickets raised"
        />
      )}

      <EmailComposeModal
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        to={client.email}
        subject={`Statement of account — ${client.company}`}
        body={`Hi ${client.name.split(" ")[0]},\n\nPlease find your statement of account attached.\n\nTotal invoiced: ${money(cInvoices.reduce((a, i) => a + i.total, 0))}\nTotal received: ${money(cInvoices.reduce((a, i) => a + i.paid, 0))}\nOutstanding balance: ${money(outstanding)}\n\nLet us know if anything looks off and we'll sort it right away.\n\nWorksuite Billing`}
        attachment={`statement-${client.company.replace(/\s+/g, "-").toLowerCase()}.pdf`}
      />
      <EmailComposeModal
        open={portalOpen}
        onClose={() => setPortalOpen(false)}
        to={client.email}
        subject="Your Worksuite client portal access"
        body={`Hi ${client.name.split(" ")[0]},\n\nWe've set up portal access for ${client.company}. From there you can view project progress, download invoices, approve estimates and raise support tickets.\n\nSet your password here: https://worksuite.biz/portal/invite/${client.id}\n\nThis link expires in 7 days.\n\nWorksuite Team`}
      />
    </>
  );
}
