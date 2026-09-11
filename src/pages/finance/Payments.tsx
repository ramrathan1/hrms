import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { clientById } from "@/data/core";
import { invoices } from "@/data/finance";
import { payInvoice } from "@/lib/api";
import { fmtDate, money, todayISO } from "@/lib/format";
import { useServerRows } from "@/lib/useServerRows";
import { useToast } from "@/lib/store";

type PaymentRow = {
  id: string;
  invoiceId: string;
  invoice: string;
  client: string;
  amount: number;
  gateway: string;
  account: string;
  date: string;
};

export default function Payments() {
  const { push } = useToast();
  const [adding, setAdding] = useState(false);

  /* The ledger only grows, so this pages against the server. */
  const table = useServerRows<PaymentRow>("payments", { pageSize: 25 });

  /* A payment belongs to an invoice: recording one has to go through the
     invoice so the balance and status are recomputed in the same transaction.
     Writing a bare payment row would leave the invoice saying it is still
     unpaid. */
  const record = async (values: Record<string, unknown>) => {
    setAdding(false);
    const result = await payInvoice(String(values.invoiceId), Number(values.amount));
    if (!result) return push("Invoice not found");
    if ("error" in result) return push(result.error);
    table.refresh();
    push(`Payment recorded — invoice is now ${result.status}`);
  };

  const outstanding = invoices.filter((i) => i.total - i.paid > 0.001);

  return (
    <>
      <PageHeader
        title="Payments"
        crumbs={["Finance"]}
        actions={
          <button className="btn-primary" onClick={() => setAdding(true)} disabled={outstanding.length === 0}>
            <Plus size={15} /> Add Payment
          </button>
        }
      />
      <DataTable
        rows={table.rows}
        server={table.server}
        selectable={false}
        emptyText="No payments recorded yet"
        columns={[
          { key: "invoice", label: "Invoice", render: (p) => <span className="font-medium text-primary">{p.invoice}</span> },
          { key: "client", label: "Client" },
          { key: "amount", label: "Amount", sort: (p) => p.amount, render: (p) => <span className="font-medium tabular-nums">{money(p.amount)}</span> },
          { key: "gateway", label: "Gateway" },
          { key: "account", label: "Reference" },
          { key: "date", label: "Paid On", sort: (p) => p.date, render: (p) => fmtDate(p.date) },
        ]}
        exportName="payments"
        rowActions={() => [{ label: "Download Receipt", onClick: () => window.print() }]}
      />

      <FormModal
        open={adding}
        title="Record a payment"
        fields={[
          {
            key: "invoiceId",
            label: "Invoice",
            type: "select",
            required: true,
            // Only invoices with something left to pay; the server refuses the rest.
            options: outstanding.map((i) => ({
              value: i.id,
              label: `${i.number} — ${money(i.total - i.paid)} outstanding (${clientById(i.clientId)?.company ?? "—"})`,
            })),
          },
          { key: "amount", label: "Amount ($)", type: "number", required: true },
          { key: "date", label: "Paid On", type: "date" },
        ]}
        initial={{ date: todayISO() }}
        submitLabel="Record payment"
        onSubmit={record}
        onClose={() => setAdding(false)}
      />
    </>
  );
}
