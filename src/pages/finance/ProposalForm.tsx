/* Full proposal builder + document detail view — like a real quoting tool:
   recipient, validity, line items, scope of work, terms, then send by email. */
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DocumentView } from "@/components/DocumentView";
import { EmailComposeModal } from "@/components/EmailComposeModal";
import { Field, FormCard, FormGrid, SelectInput, TextArea, TextInput, DateInput } from "@/components/FormKit";
import { LineItemsEditor } from "@/components/LineItems";
import { PageHeader } from "@/components/PageHeader";
import { leads } from "@/data/crm";
import { invoiceItems, proposals } from "@/data/finance";
import { api } from "@/lib/api";
import { money, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function ProposalForm() {
  const nav = useNavigate();
  const { push } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [total, setTotal] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);

  const collect = () => {
    const v = Object.fromEntries(new FormData(formRef.current!).entries());
    const lead = leads.find((l) => l.company === v.lead) ?? leads[0];
    return { v, lead };
  };

  const save = (status: "Draft" | "Sent") => {
    const { v, lead } = collect();
    const proposal = {
      id: `pr-${Date.now().toString(36)}`,
      number: String(v.number || `PROP#${String(proposals.length + 4).padStart(3, "0")}`),
      leadName: lead.company,
      total,
      date: todayISO(),
      valid: String(v.valid || "2026-09-28"),
      status,
    };
    proposals.unshift(proposal);
    void api.create("proposals", proposal);
    push(status === "Sent" ? `${proposal.number} sent to ${lead.email}` : `${proposal.number} saved as draft`);
    nav("/finance/proposals");
  };

  const { lead } = formRef.current ? collect() : { lead: leads[0] };

  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
      <PageHeader title="New Proposal" crumbs={["Finance", "Proposals"]} />
      <FormCard title="Proposal Details">
        <FormGrid>
          <Field label="Proposal Number" required><TextInput defaultValue={`PROP#${String(proposals.length + 4).padStart(3, "0")}`} name="number" /></Field>
          <Field label="Send To (Lead)" required><SelectInput options={leads.map((l) => l.company)} name="lead" /></Field>
          <Field label="Valid Till" required><DateInput defaultValue="2026-09-28" name="valid" /></Field>
          <Field label="Currency"><SelectInput options={["USD ($)", "GBP (£)", "EUR (€)", "INR (₹)"]} /></Field>
          <Field label="Proposal Title" span><TextInput placeholder="e.g. Website redesign & 12-month support" name="title" /></Field>
        </FormGrid>
      </FormCard>
      <div className="h-5" />
      <FormCard title="Items & Pricing">
        <LineItemsEditor onTotal={setTotal} />
      </FormCard>
      <div className="h-5" />
      <FormCard title="Scope & Terms">
        <FormGrid cols={2}>
          <Field label="Scope of Work"><TextArea rows={5} placeholder={"What's included:\n• Discovery & UX audit\n• Design system + 8 templates\n• Development, QA and launch"} /></Field>
          <Field label="Terms & Conditions"><TextArea rows={5} placeholder={"• 40% advance to begin, 60% on delivery\n• Two revision rounds included\n• Valid till the date above"} /></Field>
        </FormGrid>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button className="btn-primary" onClick={() => setComposeOpen(true)}>
            <Send size={14} /> Save &amp; Send to Client
          </button>
          <button className="btn-outline" onClick={() => save("Draft")}>Save as Draft</button>
          <button className="btn-ghost" onClick={() => nav("/finance/proposals")}>Cancel</button>
          <span className="ml-auto text-sm text-muted">Total: <b className="text-ink tabular-nums">{money(total)}</b></span>
        </div>
      </FormCard>

      <EmailComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        to={lead.email}
        subject={`Proposal from Worksuite — ${money(total)}`}
        body={`Hi ${lead.name.split(" ")[0]},\n\nPlease find our proposal attached. It covers the full scope we discussed and is valid until the date noted inside.\n\nHappy to walk you through it on a call — just reply with a time that works.\n\nBest,\nMohammed Ziemann\nWorksuite`}
        attachment="proposal.pdf"
        onSent={() => save("Sent")}
      />
    </form>
  );
}

export function ProposalDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { push } = useToast();
  const [composeOpen, setComposeOpen] = useState(false);
  const proposal = proposals.find((p) => p.id === id) ?? proposals[0];
  const lead = leads.find((l) => l.company === proposal.leadName);
  const [status, setStatus] = useState(proposal.status);

  const decide = (s: "Accepted" | "Declined") => {
    setStatus(s);
    proposal.status = s;
    void api.update("proposals", proposal.id, { status: s });
    push(`${proposal.number} marked ${s}`);
  };

  return (
    <>
      <PageHeader
        title={proposal.number}
        crumbs={["Finance", "Proposals"]}
        actions={
          <>
            <button className="btn-outline" onClick={() => setComposeOpen(true)}>
              <Send size={14} /> Send to Client
            </button>
            {status !== "Accepted" && (
              <button className="btn-primary" onClick={() => decide("Accepted")}>
                <CheckCircle2 size={14} /> Mark Accepted
              </button>
            )}
            {status !== "Declined" && status !== "Accepted" && (
              <button className="btn-outline text-bad" onClick={() => decide("Declined")}>
                <XCircle size={14} /> Decline
              </button>
            )}
          </>
        }
      />
      <DocumentView
        kind="Proposal"
        number={proposal.number}
        status={status}
        client={{ name: lead?.name ?? proposal.leadName, company: proposal.leadName, email: lead?.email ?? "—" }}
        date={proposal.date}
        due={proposal.valid}
        items={invoiceItems}
        note="This proposal is valid until the date above. 40% advance to begin, balance on delivery. Two revision rounds included."
      />
      <EmailComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        to={lead?.email ?? ""}
        subject={`Proposal ${proposal.number} from Worksuite`}
        body={`Hi ${lead?.name.split(" ")[0] ?? "there"},\n\nSharing proposal ${proposal.number} (${money(proposal.total)}) — valid till ${proposal.valid}.\n\nBest,\nMohammed Ziemann`}
        attachment={`${proposal.number}.pdf`}
        onSent={() => {
          setStatus("Sent");
          void api.update("proposals", proposal.id, { status: "Sent" });
        }}
      />
      <p className="mt-4 text-center">
        <button className="text-sm text-primary hover:underline" onClick={() => nav("/finance/proposals")}>← Back to proposals</button>
      </p>
    </>
  );
}
