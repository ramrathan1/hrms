import { Download, Send } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { DocumentView } from "@/components/DocumentView";
import { EmailComposeModal } from "@/components/EmailComposeModal";
import { PageHeader } from "@/components/PageHeader";
import { clientById } from "@/data/core";
import { invoiceItems, invoices, payments } from "@/data/finance";
import { fmtDate, money } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function InvoiceDetail() {
  const { id } = useParams();
  /* Non-null by construction: the route wraps this page in RequireRecord,
     which only renders it once the record is in the store. */
  const inv = invoices.find((i) => i.id === id)!;
  const client = clientById(inv.clientId)!;
  const { push } = useToast();
  const [composeOpen, setComposeOpen] = useState(false);
  const invPayments = payments.filter((p) => p.invoiceId === inv.id);
  return (
    <>
      <PageHeader
        title={inv.number}
        crumbs={["Finance", "Invoices"]}
        actions={
          <>
            <button className="btn-outline" onClick={() => setComposeOpen(true)}>
              <Send size={15} /> Send
            </button>
            <button className="btn-primary" onClick={() => window.print()}>
              <Download size={15} /> Download / Print
            </button>
          </>
        }
      />
      <DocumentView
        kind="Invoice"
        number={inv.number}
        status={inv.status}
        client={{ name: client.name, company: client.company, email: client.email }}
        date={inv.date}
        due={inv.due}
        items={invoiceItems}
        discountPct={0}
      />
      {invPayments.length > 0 && (
        <div className="card mx-auto mt-5 max-w-3xl">
          <div className="border-b border-line px-5 py-3.5 text-[15px] font-semibold">Payment History</div>
          <table className="tbl w-full text-sm">
            <thead>
              <tr><th>Paid On</th><th>Gateway</th><th>Bank Account</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody>
              {invPayments.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.date)}</td>
                  <td>{p.gateway}</td>
                  <td>{p.account}</td>
                  <td className="text-right font-medium tabular-nums">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <EmailComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        to={client.email}
        subject={`Invoice ${inv.number} from Worksuite`}
        body={`Hi ${client.name.split(" ")[0]},\n\nPlease find invoice ${inv.number} for ${money(inv.total)} attached. Payment is due by ${fmtDate(inv.due)}.\n\nThank you for your business!\nWorksuite Billing`}
        attachment={`${inv.number}.pdf`}
        onSent={() => push(`${inv.number} emailed to ${client.email}`)}
      />
    </>
  );
}
