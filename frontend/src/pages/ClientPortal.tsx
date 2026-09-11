/* Client-facing portal — what a client sees when they follow their invite link.
   Read-only project progress, invoices with Pay now, estimate approvals and a
   ticket raiser. Deliberately outside the staff AppShell. */
import clsx from "clsx";
import { CheckCircle2, CreditCard, FileText, LifeBuoy, LogOut, MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckoutModal } from "@/components/CheckoutModal";
import { FormModal } from "@/components/crud";
import { Avatar, Progress, StatusPill, Tabs } from "@/components/ui";
import { clientById, clients } from "@/data/core";
import { estimates, invoices, payments } from "@/data/finance";
import { tickets } from "@/data/ops";
import { projects } from "@/data/work";
import { api, payInvoice } from "@/lib/api";
import { fmtDate, money, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function ClientPortal() {
  const { clientId } = useParams();
  const nav = useNavigate();
  const { push } = useToast();
  const client = clientById(clientId) ?? clients[0];
  const [tab, setTab] = useState("Projects");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [paid, setPaid] = useState<Record<string, boolean>>({});
  const [checkout, setCheckout] = useState<(typeof invoices)[number] | null>(null);
  const [approved, setApproved] = useState<Record<string, string>>({});

  const cProjects = projects.filter((p) => p.clientId === client.id);
  const cInvoices = invoices.filter((i) => i.clientId === client.id);
  const cEstimates = estimates.filter((e) => e.clientId === client.id);
  const cTickets = tickets.filter((t) => t.requester === client.name);
  const due = cInvoices.reduce((a, i) => a + (paid[i.id] ? 0 : i.total - i.paid), 0);

  return (
    <div className="min-h-full">
      {/* portal chrome — deliberately different from the staff app */}
      <header className="border-b border-line bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-6 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#4cc3ff] text-base font-black text-white">W</span>
          <div>
            <p className="font-display text-[15px] font-bold">Worksuite Client Portal</p>
            <p className="text-xs text-muted">{client.company}</p>
          </div>
          <span className="ml-auto flex items-center gap-3">
            <Avatar name={client.name} size={32} />
            <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => nav("/clients")}>
              <LogOut size={13} /> Exit preview
            </button>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-7">
        <h1 className="font-display text-2xl font-bold">Welcome back, {client.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted">
          {cProjects.length} active project{cProjects.length === 1 ? "" : "s"} ·{" "}
          {due > 0 ? <b className="text-bad">{money(due)} outstanding</b> : <b className="text-good">No outstanding balance</b>}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card px-5 py-4">
            <p className="text-[13px] font-semibold text-muted">Projects</p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums">{cProjects.length}</p>
          </div>
          <div className="card px-5 py-4">
            <p className="text-[13px] font-semibold text-muted">Invoices</p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums">{cInvoices.length}</p>
          </div>
          <div className="card px-5 py-4">
            <p className="text-[13px] font-semibold text-muted">Outstanding</p>
            <p className={clsx("mt-1 font-display text-xl font-bold tabular-nums", due > 0 ? "text-bad" : "text-good")}>{money(due)}</p>
          </div>
        </div>

        <div className="card mt-5 px-2">
          <Tabs tabs={["Projects", "Invoices", "Estimates", "Support"]} active={tab} onChange={setTab} className="border-b-0" />
        </div>

        {tab === "Projects" && (
          <div className="mt-4 space-y-3">
            {cProjects.map((p) => (
              <div key={p.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-56 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted">Started {fmtDate(p.start)} · due {fmtDate(p.deadline)}</p>
                </div>
                <Progress value={p.progress} />
                <StatusPill status={p.status} />
              </div>
            ))}
            {cProjects.length === 0 && <p className="card p-10 text-center text-sm text-faint">No projects yet.</p>}
          </div>
        )}

        {tab === "Invoices" && (
          <div className="mt-4 space-y-3">
            {cInvoices.map((i) => {
              const settled = paid[i.id] || i.total - i.paid <= 0;
              return (
                <div key={i.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
                  <FileText size={18} className="text-primary" />
                  <div className="min-w-40 flex-1">
                    <p className="font-semibold">{i.number}</p>
                    <p className="text-xs text-muted">Issued {fmtDate(i.date)} · due {fmtDate(i.due)}</p>
                  </div>
                  <span className="font-display text-lg font-bold tabular-nums">{money(i.total)}</span>
                  <StatusPill status={settled ? "Paid" : i.status} />
                  {!settled ? (
                    <button className="btn-primary px-4 py-1.5 text-xs" onClick={() => setCheckout(i)}>
                      <CreditCard size={13} /> Pay now
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-good"><CheckCircle2 size={13} /> Settled</span>
                  )}
                </div>
              );
            })}
            {cInvoices.length === 0 && <p className="card p-10 text-center text-sm text-faint">No invoices yet.</p>}
          </div>
        )}

        {tab === "Estimates" && (
          <div className="mt-4 space-y-3">
            {cEstimates.map((e) => {
              const state = approved[e.id] ?? e.status;
              return (
                <div key={e.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-40 flex-1">
                    <p className="font-semibold">{e.number}</p>
                    <p className="text-xs text-muted">Valid until {fmtDate(e.valid)}</p>
                  </div>
                  <span className="font-display text-lg font-bold tabular-nums">{money(e.total)}</span>
                  <StatusPill status={state} />
                  {state !== "Accepted" && state !== "Declined" && (
                    <span className="flex gap-2">
                      <button
                        className="btn-primary px-3 py-1.5 text-xs"
                        onClick={() => {
                          setApproved((a) => ({ ...a, [e.id]: "Accepted" }));
                          void api.update("estimates", e.id, { status: "Accepted" });
                          push(`${e.number} approved — thank you!`);
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-outline px-3 py-1.5 text-xs text-bad"
                        onClick={() => {
                          setApproved((a) => ({ ...a, [e.id]: "Declined" }));
                          void api.update("estimates", e.id, { status: "Declined" });
                          push(`${e.number} declined`);
                        }}
                      >
                        Decline
                      </button>
                    </span>
                  )}
                </div>
              );
            })}
            {cEstimates.length === 0 && <p className="card p-10 text-center text-sm text-faint">No estimates to review.</p>}
          </div>
        )}

        {tab === "Support" && (
          <div className="mt-4">
            <button className="btn-primary mb-4" onClick={() => setTicketOpen(true)}>
              <MessageSquarePlus size={15} /> Raise a support ticket
            </button>
            <div className="space-y-3">
              {cTickets.map((t) => (
                <div key={t.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
                  <LifeBuoy size={17} className="text-primary" />
                  <div className="min-w-40 flex-1">
                    <p className="font-semibold">{t.subject}</p>
                    <p className="text-xs text-muted">{t.number} · updated {fmtDate(t.updated)}</p>
                  </div>
                  <StatusPill status={t.priority} />
                  <StatusPill status={t.status} />
                </div>
              ))}
              {cTickets.length === 0 && <p className="card p-10 text-center text-sm text-faint">No tickets — everything running smoothly.</p>}
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-faint">
          Staff preview of the client portal · clients reach this via their invite link
        </p>
      </main>

      {checkout && (
        <CheckoutModal
          open
          onClose={() => setCheckout(null)}
          amount={checkout.total - checkout.paid}
          reference={checkout.number}
          payerEmail={client.email}
          onPaid={async () => {
            const invoiceId = checkout.id;
            setCheckout(null);
            // Through the invoice, so the balance and status are recomputed in
            // the same transaction — a bare payment row would leave the invoice
            // still claiming it is unpaid.
            const result = await payInvoice(invoiceId);
            if (!result || "error" in result) {
              return push(result && "error" in result ? result.error : "Payment failed");
            }
            setPaid((prev) => ({ ...prev, [invoiceId]: true }));
            push("Payment received — thank you");
          }}
        />
      )}

      <FormModal
        open={ticketOpen}
        title="Raise a support ticket"
        fields={[
          { key: "subject", label: "What do you need help with?", required: true, span: true },
          { key: "priority", label: "How urgent is it?", type: "select", options: ["Low", "Medium", "High"] },
          { key: "detail", label: "Tell us more", type: "textarea", span: true },
        ]}
        initial={{ priority: "Medium" }}
        submitLabel="Submit ticket"
        onSubmit={(v) => {
          const t = {
            id: `TKT#${String(tickets.length + 13).padStart(3, "0")}`,
            subject: String(v.subject),
            requester: client.name,
            agent: "e9",
            priority: String(v.priority),
            status: "Open",
            updated: todayISO(),
            group: "Technical",
            type: "Problem",
          };
          tickets.push(t as never);
          void api.create("tickets", t);
          push("Ticket raised — our team will respond shortly");
          setTicketOpen(false);
        }}
        onClose={() => setTicketOpen(false)}
      />
    </div>
  );
}
