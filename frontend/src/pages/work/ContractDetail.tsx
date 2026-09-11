import { Download, PenLine } from "lucide-react";
import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui";
import { clientById } from "@/data/core";
import { contracts } from "@/data/work";
import { fmtDate, money } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function ContractDetail() {
  const { id } = useParams();
  /* Non-null by construction: the route wraps this page in RequireRecord,
     which only renders it once the record is in the store. */
  const c = contracts.find((x) => x.id === id)!;
  const client = clientById(c.clientId)!;
  const { push } = useToast();
  return (
    <>
      <PageHeader
        title={c.number}
        crumbs={["Work", "Contracts"]}
        actions={
          <>
            <button className="btn-outline" onClick={() => push("Download started")}>
              <Download size={15} /> Download
            </button>
            {!c.signed && (
              <button className="btn-primary" onClick={() => push("Signature request sent")}>
                <PenLine size={15} /> Request Signature
              </button>
            )}
          </>
        }
      />
      <div className="card mx-auto max-w-3xl p-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[#4cc3ff] text-lg font-black text-white">W</span>
            <div>
              <p className="font-bold">Worksuite</p>
              <p className="text-xs text-muted">https://worksuite.biz</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase">Contract</p>
            <p className="text-sm text-muted">{c.number}</p>
            <div className="mt-2"><StatusPill status={c.signed ? "Signed" : "Pending"} /></div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold text-muted uppercase">Client</p>
            <p className="font-semibold">{client.name}</p>
            <p className="text-muted">{client.company}</p>
          </div>
          <div className="text-right">
            <p><span className="text-muted">Contract Value: </span><b>{money(c.amount)}</b></p>
            <p><span className="text-muted">Period: </span><b>{fmtDate(c.start)} – {fmtDate(c.end)}</b></p>
            <p><span className="text-muted">Type: </span><b>{c.type}</b></p>
          </div>
        </div>
        <h3 className="mt-8 mb-2 font-semibold">{c.subject}</h3>
        <p className="text-sm leading-relaxed text-muted">
          This agreement covers the scope of services described above. Deliverables, acceptance criteria,
          and payment milestones follow the statement of work attached to this contract. Either party may
          terminate with 30 days written notice. All intellectual property transfers on full payment.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-6">
          <div className="rounded-md border border-dashed border-line p-5 text-center text-sm text-muted">
            <p className="mb-6 font-medium text-ink">Worksuite</p>
            <p className="border-t border-line pt-2">Authorised Signature</p>
          </div>
          <div className="rounded-md border border-dashed border-line p-5 text-center text-sm text-muted">
            <p className={"mb-6 font-medium " + (c.signed ? "font-serif italic" : "text-faint")}>{c.signed ? client.name : "Awaiting signature"}</p>
            <p className="border-t border-line pt-2">Client Signature</p>
          </div>
        </div>
      </div>
    </>
  );
}
