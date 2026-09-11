import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { DocumentView } from "@/components/DocumentView";
import { EmailComposeModal } from "@/components/EmailComposeModal";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import { clientById, clients } from "@/data/core";
import { estimates, invoiceItems, invoices } from "@/data/finance";
import { fmtDate, money, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

export function EstimateDetail() {
  const { id } = useParams();
  /* Non-null by construction: the route wraps this page in RequireRecord,
     which only renders it once the record is in the store. */
  const est = estimates.find((e) => e.id === id)!;
  const client = clientById(est.clientId)!;
  const { push } = useToast();
  return (
    <>
      <PageHeader
        title={est.number}
        crumbs={["Finance", "Estimates"]}
        actions={
          <>
            <button className="btn-primary" onClick={() => push("Marked as Accepted")}>Accept</button>
            <button className="btn-outline" onClick={() => push("Marked as Declined")}>Decline</button>
          </>
        }
      />
      <DocumentView
        kind="Estimate"
        number={est.number}
        status={est.status}
        client={{ name: client.name, company: client.company, email: client.email }}
        date={est.date}
        due={est.valid}
        items={invoiceItems}
      />
    </>
  );
}

export default function Estimates() {
  const { push } = useToast();
  const nav = useNavigate();
  const [emailFor, setEmailFor] = useState<(typeof estimates)[number] | null>(null);
  const crud = useCrud({
    collection: "estimates",
    seed: estimates,
    itemName: "Estimate",
    onView: (e) => nav(`/finance/estimates/${e.id}`),
    makeId: (its) => `es${its.length + 1}-${Date.now().toString(36)}`,
    fields: [
      { key: "number", label: "Estimate Number", required: true },
      { key: "clientId", label: "Client", type: "select", options: clients.map((c) => ({ value: c.id, label: c.company })) },
      { key: "total", label: "Total ($)", type: "number", required: true },
      { key: "date", label: "Estimate Date", type: "date" },
      { key: "valid", label: "Valid Till", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Sent", "Accepted", "Declined"] },
    ],
    defaults: { date: todayISO(), valid: "2026-09-28" } as never,
  });
  return (
    <>
      <PageHeader
        title="Estimates"
        crumbs={["Finance"]}
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Create Estimate
          </button>
        }
      />
      <FilterBar><DurationFilter /></FilterBar>
      <DataTable
        rows={crud.items}
        columns={[
          { key: "number", label: "Estimate", render: (e) => <Link to={`/finance/estimates/${e.id}`} className="font-medium text-primary">{e.number}</Link> },
          { key: "client", label: "Client", render: (e) => clientById(e.clientId)?.company },
          { key: "total", label: "Total", sort: (e) => e.total, render: (e) => money(e.total) },
          { key: "valid", label: "Valid Till", render: (e) => fmtDate(e.valid) },
          { key: "status", label: "Status", render: (e) => <StatusPill status={e.status} /> },
        ]}
        exportName="estimates"
        onBulkDelete={crud.removeMany}
        bulkActions={[{ label: "Mark Sent", onClick: (rs) => crud.updateMany(rs, { status: "Sent" } as never, "sent") }]}
        rowActions={(e) =>
          crud.rowActions(e, [
            { label: "Send by Email", onClick: () => setEmailFor(e) },
            {
              label: "Convert to Invoice",
              onClick: () => {
                const inv = {
                  id: `inv-${Date.now()}`,
                  number: `INV#${String(invoices.length + 20).padStart(3, "0")}`,
                  clientId: e.clientId,
                  total: e.total,
                  paid: 0,
                  date: todayISO(),
                  due: "2026-09-13",
                  status: "Unpaid" as const,
                };
                invoices.push(inv);
                void api.create("invoices", inv);
                crud.update(e.id, { status: "Accepted" } as never, true);
                push(`${inv.number} created from ${e.number}`);
                nav("/finance/invoices");
              },
            },
          ])
        }
      />
      {emailFor && (
        <EmailComposeModal
          open
          onClose={() => setEmailFor(null)}
          to={clientById(emailFor.clientId)?.email ?? ""}
          subject={`Estimate ${emailFor.number} from Worksuite`}
          body={`Hi ${clientById(emailFor.clientId)?.name.split(" ")[0]},\n\nPlease find estimate ${emailFor.number} for ${money(emailFor.total)} attached — it's valid until ${fmtDate(emailFor.valid)}.\n\nApprove it and we'll convert it into an invoice and get started.\n\nBest,\nWorksuite`}
          attachment={`${emailFor.number}.pdf`}
          onSent={() => crud.update(emailFor.id, { status: "Sent" } as never, true)}
        />
      )}
      {crud.modals}
    </>
  );
}
