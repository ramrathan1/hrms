/* Client-facing project progress report — a clean, shareable status summary
   you can print, email to the client, or open in their portal. */
import clsx from "clsx";
import { CheckCircle2, Download, Send } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EmailComposeModal } from "@/components/EmailComposeModal";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, StatusPill } from "@/components/ui";
import { byId, clientById } from "@/data/core";
import { invoices } from "@/data/finance";
import { milestones, projectById, projects, tasks } from "@/data/work";
import { fmtDate, money, todayISO } from "@/lib/format";

export default function ProjectReport() {
  const { id } = useParams();
  const nav = useNavigate();
  /* Non-null by construction: the route wraps this page in RequireRecord,
     which only renders it once the record is in the store. */
  const project = projectById(id)!;
  const client = clientById(project.clientId);
  const [emailOpen, setEmailOpen] = useState(false);

  const pTasks = tasks.filter((t) => t.projectId === project.id);
  const done = pTasks.filter((t) => t.status === "Completed");
  const inFlight = pTasks.filter((t) => t.status === "Doing");
  const upcoming = pTasks.filter((t) => t.status === "Todo" || t.status === "Incomplete");
  const pMilestones = milestones.filter((m) => m.projectId === project.id);
  const pInvoices = invoices.filter((i) => i.projectId === project.id);
  const daysLeft = Math.max(0, Math.round((new Date(project.deadline).getTime() - new Date(todayISO()).getTime()) / 86400000));

  return (
    <>
      <PageHeader
        title="Progress Report"
        crumbs={["Work", "Projects"]}
        actions={
          <>
            <button className="btn-outline" onClick={() => nav(`/work/projects/${project.id}`)}>Back to project</button>
            <button className="btn-outline" onClick={() => window.print()}>
              <Download size={15} /> Print / PDF
            </button>
            <button className="btn-primary" onClick={() => setEmailOpen(true)}>
              <Send size={15} /> Send to client
            </button>
          </>
        }
      />

      <div className="card mx-auto max-w-3xl p-8">
        {/* letterhead */}
        <div className="flex items-start justify-between border-b border-line pb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#4cc3ff] text-lg font-black text-white">W</span>
            <div>
              <p className="font-bold">Worksuite</p>
              <p className="text-xs text-muted">Progress report · {fmtDate(todayISO())}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-lg font-bold">{project.name}</p>
            <p className="text-sm text-muted">Prepared for {client?.company ?? "client"}</p>
          </div>
        </div>

        {/* headline */}
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ["Overall progress", `${project.progress}%`],
            ["Tasks complete", `${done.length}/${pTasks.length}`],
            ["Days to deadline", String(daysLeft)],
            ["Status", project.status],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line bg-page/50 p-4">
              <p className="text-xs font-semibold text-muted">{k}</p>
              <p className="mt-1 font-display text-lg font-bold">{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
            <span>Started {fmtDate(project.start)}</span>
            <span>Due {fmtDate(project.deadline)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-[#4cc3ff]" style={{ width: `${project.progress}%` }} />
          </div>
        </div>

        {/* milestones */}
        {pMilestones.length > 0 && (
          <section className="mt-8">
            <h3 className="font-display text-[15px] font-bold">Milestones</h3>
            <ul className="mt-3 space-y-2">
              {pMilestones.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-2.5 text-sm">
                  <CheckCircle2 size={15} className={m.status === "Complete" ? "text-good" : "text-line"} />
                  <span className="min-w-40 flex-1 font-medium">{m.title}</span>
                  <span className="text-xs text-muted">Due {fmtDate(m.due)}</span>
                  <StatusPill status={m.status} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* what happened */}
        <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-display text-[15px] font-bold text-good">Completed</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {done.slice(0, 6).map((t) => (
                <li key={t.id} className="flex gap-2 text-muted">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-good" />
                  {t.title}
                </li>
              ))}
              {done.length === 0 && <li className="text-xs text-faint">Nothing completed yet this period.</li>}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-[15px] font-bold text-info">In progress</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {inFlight.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-muted">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
                  <span className="flex-1">{t.title}</span>
                  {t.assignees[0] && <Avatar name={byId(t.assignees[0])?.name ?? ""} size={20} />}
                </li>
              ))}
              {inFlight.length === 0 && <li className="text-xs text-faint">No work currently in flight.</li>}
            </ul>
          </div>
        </section>

        {/* next up */}
        <section className="mt-6">
          <h3 className="font-display text-[15px] font-bold">Coming next</h3>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 text-sm md:grid-cols-2">
            {upcoming.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-muted">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-faint" />
                <span className="flex-1">{t.title}</span>
                <span className={clsx("text-xs", t.due < todayISO() ? "font-semibold text-bad" : "text-faint")}>{fmtDate(t.due)}</span>
              </li>
            ))}
            {upcoming.length === 0 && <li className="text-xs text-faint">Backlog is clear.</li>}
          </ul>
        </section>

        {/* commercials */}
        {pInvoices.length > 0 && (
          <section className="mt-8 border-t border-line pt-5">
            <h3 className="font-display text-[15px] font-bold">Billing summary</h3>
            <div className="mt-3 flex flex-wrap gap-6 text-sm">
              <span>Invoiced: <b className="tabular-nums">{money(pInvoices.reduce((a, i) => a + i.total, 0))}</b></span>
              <span>Received: <b className="tabular-nums text-good">{money(pInvoices.reduce((a, i) => a + i.paid, 0))}</b></span>
              <span>Outstanding: <b className="tabular-nums text-bad">{money(pInvoices.reduce((a, i) => a + (i.total - i.paid), 0))}</b></span>
            </div>
          </section>
        )}

        <p className="mt-8 border-t border-line pt-4 text-xs text-muted">
          Questions about this report? Reply to this email or raise a ticket in your client portal.
        </p>
      </div>

      <EmailComposeModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        to={client?.email ?? ""}
        subject={`Progress report — ${project.name}`}
        body={`Hi ${client?.name.split(" ")[0] ?? "there"},\n\nHere's this week's progress on ${project.name}.\n\n• Overall progress: ${project.progress}%\n• Tasks completed: ${done.length} of ${pTasks.length}\n• Currently in progress: ${inFlight.length}\n• Days to deadline: ${daysLeft}\n\nThe full report is attached. Happy to walk through it on a call.\n\nBest,\nWorksuite Delivery`}
        attachment={`${project.code}-progress-report.pdf`}
      />
    </>
  );
}
