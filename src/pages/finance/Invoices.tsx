import { Plus, Send } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { EmailComposeModal } from "@/components/EmailComposeModal";
import { useCrud } from "@/components/crud";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { AvatarName, SearchInput, Select, StatusPill } from "@/components/ui";
import { clientById, clients } from "@/data/core";
import { invoices, payments } from "@/data/finance";
import { api, payInvoice } from "@/lib/api";
import { fmtDate, money, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function Invoices() {
  const [status, setStatus] = useState("All");
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const { push } = useToast();
  const crud = useCrud({
    collection: "invoices",
    seed: invoices,
    itemName: "Invoice",
    onView: (i) => nav(`/finance/invoices/${i.id}`),
    fields: [
      { key: "number", label: "Invoice Number", required: true },
      { key: "clientId", label: "Client", type: "select", options: clients.map((c) => ({ value: c.id, label: c.company })) },
      { key: "total", label: "Total ($)", type: "number", required: true },
      { key: "date", label: "Invoice Date", type: "date" },
      { key: "due", label: "Due Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Draft", "Unpaid", "Partially Paid", "Paid", "Overdue"] },
    ],
  });
  const recordPayment = async (id: string) => {
    const res = await payInvoice(id);
    if (!res) return push("Invoice not found");
    if ("error" in res) return push(res.error);
    // The server recomputed the balance and status; mirror its answer into this
    // page's state rather than recalculating it here.
    crud.update(id, { paid: res.paid, status: res.status } as never, true);
    push(res.status === "Paid" ? "Payment recorded — invoice marked Paid" : `Payment recorded — ${res.status}`);
  };
  const [emailFor, setEmailFor] = useState<{ inv: (typeof invoices)[number]; reminder: boolean } | null>(null);
  const emailClient = emailFor ? clientById(emailFor.inv.clientId) : null;
  const rows = crud.items.filter(
    (i) => (status === "All" || i.status === status) && i.number.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <>
      <PageHeader
        title="Invoices"
        crumbs={["Finance"]}
        actions={
          <>
            <Link to="/finance/invoices/new" className="btn-primary">
              <Plus size={15} /> Create Invoice
            </Link>
            <button
              className="btn-outline"
              onClick={() => {
                const overdue = crud.items.filter((i) => i.total - i.paid > 0 && i.due < todayISO());
                if (overdue.length === 0) return push("No overdue invoices — nothing to chase");
                overdue.forEach((i) =>
                  void api.create("outbox", {
                    to: clientById(i.clientId)?.email,
                    subject: `Payment reminder — ${i.number}`,
                    body: `${money(i.total - i.paid)} outstanding, due ${fmtDate(i.due)}.`,
                    date: new Date().toISOString(),
                  })
                );
                push(`${overdue.length} payment reminders sent`);
              }}
            >
              <Send size={15} /> Chase overdue
            </button>
          </>
        }
      />
      <FilterBar>
        <DurationFilter />
        <Select label="Status" value={status} onChange={setStatus} options={["All", "Paid", "Partially Paid", "Unpaid", "Overdue", "Draft"]} />
        <SearchInput value={q} onChange={setQ} />
      </FilterBar>
      <DataTable
        rows={rows}
        columns={[
          { key: "number", label: "Invoice", sort: (i) => i.number, render: (i) => <Link to={`/finance/invoices/${i.id}`} className="font-medium text-primary">{i.number}</Link> },
          { key: "client", label: "Client", render: (i) => <AvatarName name={clientById(i.clientId)?.name ?? "—"} sub={clientById(i.clientId)?.company} size={28} /> },
          { key: "total", label: "Total", sort: (i) => i.total, render: (i) => <span className="font-medium tabular-nums">{money(i.total)}</span> },
          { key: "unpaid", label: "Unpaid", render: (i) => <span className={"tabular-nums " + (i.total - i.paid > 0 ? "text-bad" : "text-good")}>{money(i.total - i.paid)}</span> },
          { key: "date", label: "Invoice Date", sort: (i) => i.date, render: (i) => fmtDate(i.date) },
          { key: "status", label: "Status", render: (i) => <StatusPill status={i.status} /> },
        ]}
        exportName="invoices"
        onBulkDelete={crud.removeMany}
        rowActions={(i) =>
          crud.rowActions(i, [
            { label: "Send by Email", onClick: () => setEmailFor({ inv: i, reminder: false }) },
            ...(i.total - i.paid > 0 && i.status !== "Draft"
              ? [
                  { label: "Send Payment Reminder", onClick: () => setEmailFor({ inv: i, reminder: true }) },
                  { label: "Add Payment", onClick: () => void recordPayment(i.id) },
                ]
              : []),
          ])
        }
      />
      {emailFor && (
        <EmailComposeModal
          open
          onClose={() => setEmailFor(null)}
          to={emailClient?.email ?? ""}
          subject={
            emailFor.reminder
              ? `Payment reminder — ${emailFor.inv.number} (${money(emailFor.inv.total - emailFor.inv.paid)} due)`
              : `Invoice ${emailFor.inv.number} from Worksuite`
          }
          body={
            emailFor.reminder
              ? `Hi ${emailClient?.name.split(" ")[0]},\n\nA friendly reminder that ${money(emailFor.inv.total - emailFor.inv.paid)} on invoice ${emailFor.inv.number} was due on ${fmtDate(emailFor.inv.due)}.\n\nYou can pay online via the link in the attached invoice. Let us know if anything is unclear.\n\nThanks,\nWorksuite Billing`
              : `Hi ${emailClient?.name.split(" ")[0]},\n\nPlease find invoice ${emailFor.inv.number} for ${money(emailFor.inv.total)} attached. Payment is due by ${fmtDate(emailFor.inv.due)}.\n\nThank you for your business!\nWorksuite Billing`
          }
          attachment={`${emailFor.inv.number}.pdf`}
          onSent={() => {
            if (emailFor.inv.status === "Draft") crud.update(emailFor.inv.id, { status: "Unpaid" } as never, true);
          }}
        />
      )}
      {crud.modals}
    </>
  );
}
