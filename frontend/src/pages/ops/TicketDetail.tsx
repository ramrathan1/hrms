/* Full helpdesk ticket view: conversation thread, canned replies, internal notes,
   assignment/status/priority controls, SLA countdown, attachments and activity. */
import clsx from "clsx";
import { Clock, Lock, Send, Tag, Timer, UserCog } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Attachments, ActivityTimeline, type FileItem } from "@/components/RecordPanels";
import { Avatar, AvatarName, StatusPill, Tabs } from "@/components/ui";
import { byId, clients, employees } from "@/data/core";
import { tickets } from "@/data/ops";
import { api, can, loadTicket, replyToTicket } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useToast } from "@/lib/store";

type Reply = { id: string; by: string; text: string; time: string; internal?: boolean };

const CANNED = [
  { label: "Acknowledge", text: "Thanks for reaching out — we've received your request and a specialist is looking into it now. We'll update you within one business day." },
  { label: "Need more info", text: "Could you share a screenshot and the exact time you saw this? That will help us reproduce the issue quickly." },
  { label: "Fixed / resolving", text: "Good news — we've deployed a fix for this. Please refresh and confirm everything looks right on your side." },
  { label: "Closing", text: "We're closing this ticket for now. If anything comes back, just reply here and it will reopen automatically." },
];

export default function TicketDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { push } = useToast();
  /* Non-null by construction: the route wraps this page in RequireRecord,
     which only renders it once the record is in the store. */
  const ticket = tickets.find((t) => String(t.id) === id)!;
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [agent, setAgent] = useState(ticket.agent);
  const [tab, setTab] = useState("Conversation");
  const [draft, setDraft] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  /* The real conversation. This list used to be seeded with two invented
     messages — one attributed to the requester, one to the agent, both composed
     from the subject line — on tickets that had no replies at all. */
  const [replies, setReplies] = useState<Reply[]>([]);
  const mayManage = can("tickets:update");

  const loadThread = useCallback(async () => {
    const detail = await loadTicket(String(ticket.id));
    if (!detail) return;
    setReplies([
      // The ticket's own body is the opening message: it is what the requester
      // wrote, and until now no screen ever showed it.
      ...(detail.body
        ? [{ id: "opening", by: ticket.requester, text: detail.body, time: "Opened" }]
        : []),
      ...detail.replies.map((r) => ({
        id: r.id,
        by: r.authorName ?? "Support",
        text: r.body,
        time: r.createdAt
          ? new Date(r.createdAt).toLocaleString([], {
              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
            })
          : "",
        internal: r.isInternal,
      })),
    ]);
  }, [ticket.id, ticket.requester]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const client = clients.find((c) => c.name === ticket.requester);
  const staffRequester = employees.find((e) => e.name === ticket.requester);

  /* Only what the record actually says. The four entries that used to sit here
     — assignment, a priority change, a status change — were written on the spot
     with invented timestamps. */
  const activity = useMemo(
    () => [
      { id: "created", by: ticket.requester, text: `raised ${ticket.number}`, time: fmtDate(ticket.updated) },
      ...replies
        .filter((r) => r.id !== "opening")
        .map((r) => ({
          id: `act-${r.id}`,
          by: r.by,
          text: r.internal ? "added an internal note" : "replied",
          time: r.time,
        })),
    ],
    [ticket.requester, ticket.number, ticket.updated, replies]
  );

  const patch = (p: Record<string, unknown>) => {
    Object.assign(ticket, p);
    void api.update("tickets", ticket.id, p);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;

    // The reply belongs on the server, not in this tab's memory: it is what the
    // requester reads, and it is what the next person to open this ticket sees.
    const sent = await replyToTicket(String(ticket.id), text, internal);
    if (!sent) return; // the API layer announced why
    await loadThread();

    /* Moving the ticket to Pending is an agent action, and PATCH /tickets is
       gated on tickets:update. Doing it after a requester's reply put "Pending"
       on screen while the server kept the ticket Open. */
    if (mayManage && !internal && status === "Open") {
      setStatus("Pending");
      patch({ status: "Pending" });
    }
    push(internal ? "Internal note added" : `Reply sent to ${ticket.requester}`);
    setDraft("");
  };

  const slaHours = priority === "High" ? 4 : priority === "Medium" ? 24 : 72;

  return (
    <>
      <PageHeader
        title={`${ticket.number} · ${ticket.subject}`}
        crumbs={["Tickets"]}
        actions={
          <>
            {!mayManage ? null : status !== "Resolved" && status !== "Closed" ? (
              <button
                className="btn-primary"
                onClick={() => {
                  setStatus("Resolved");
                  patch({ status: "Resolved" });
                  push(`${ticket.number} resolved`);
                }}
              >
                Mark Resolved
              </button>
            ) : (
              <button
                className="btn-outline"
                onClick={() => {
                  setStatus("Open");
                  patch({ status: "Open" });
                  push(`${ticket.id} reopened`);
                }}
              >
                Reopen
              </button>
            )}
            <button className="btn-outline" onClick={() => nav("/tickets")}>Back to list</button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* conversation */}
        <div className="xl:col-span-2">
          <div className="card overflow-hidden">
            <div className="px-2 pt-1">
              <Tabs tabs={["Conversation", "Attachments", "Activity"]} active={tab} onChange={setTab} className="border-b-0" />
            </div>

            {tab === "Conversation" && (
              <div className="p-5">
                <ul className="space-y-4">
                  {replies.map((r) => (
                    <li key={r.id} className="flex gap-3">
                      <Avatar name={r.by} size={34} />
                      <div
                        className={clsx(
                          "min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm",
                          r.internal ? "border-warn/30 bg-warn-soft/60" : "border-line bg-white/70"
                        )}
                      >
                        <p className="flex flex-wrap items-baseline gap-2">
                          <span className="font-bold">{r.by}</span>
                          <span className="text-xs text-faint">{r.time}</span>
                          {r.internal && (
                            <span className="flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-bold text-[#a9720e] uppercase">
                              <Lock size={9} /> Internal note
                            </span>
                          )}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-muted">{r.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* composer */}
                <div className="mt-5 rounded-xl border border-line bg-white">
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
                    {/* Writing a note about the request, and answering with a
                        canned line, are both the support side of the desk. */}
                    {mayManage && (
                      <>
                        <button
                          className={clsx("btn rounded-lg px-2.5 py-1 text-xs font-semibold", !internal ? "bg-primary-soft text-primary" : "text-muted hover:bg-page")}
                          onClick={() => setInternal(false)}
                        >
                          Reply to customer
                        </button>
                        <button
                          className={clsx("btn rounded-lg px-2.5 py-1 text-xs font-semibold", internal ? "bg-warn-soft text-[#a9720e]" : "text-muted hover:bg-page")}
                          onClick={() => setInternal(true)}
                        >
                          <Lock size={11} /> Internal note
                        </button>
                      </>
                    )}
                    <span className="ml-auto flex flex-wrap items-center gap-1">
                      {mayManage && <span className="mr-1 text-[11px] font-semibold text-faint">Canned:</span>}
                      {(mayManage ? CANNED : []).map((c) => (
                        <button
                          key={c.label}
                          className="btn rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-muted hover:border-primary hover:text-primary"
                          onClick={() => setDraft(c.text)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      internal
                        ? "Note for the team (not visible to the customer)…"
                        : mayManage
                          ? `Reply to ${ticket.requester}…`
                          : "Add to this ticket…"
                    }
                    className="w-full resize-y px-4 py-3 text-sm outline-none placeholder:text-faint"
                  />
                  <div className="flex items-center gap-3 border-t border-line px-3 py-2">
                    <button className="btn-primary px-4 py-1.5 text-xs" onClick={send}>
                      <Send size={13} /> {internal ? "Add note" : "Send reply"}
                    </button>
                    <span className="text-[11px] text-faint">
                      {mayManage
                        ? "Replies go to the requester and set the ticket to Pending."
                        : "Your reply is added to the ticket and the support team is notified."}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {tab === "Attachments" && (
              <div className="p-5">
                <Attachments
                  files={files}
                  onAdd={(f) => setFiles((fs) => [...fs, f])}
                  onRemove={(fid) => setFiles((fs) => fs.filter((x) => x.id !== fid))}
                  collection="tickets"
                  recordId={String(ticket.id)}
                />
              </div>
            )}

            {tab === "Activity" && (
              <div className="p-5">
                <ActivityTimeline items={activity} />
              </div>
            )}
          </div>
        </div>

        {/* properties */}
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="mb-3.5 font-display text-[15px] font-bold">Ticket properties</h3>
            {!mayManage && (
              <p className="mb-3 text-xs text-muted">
                Status, priority and assignment are set by the support team.
              </p>
            )}
            <div className="space-y-3.5 text-sm">
              {!mayManage ? (
                <dl className="space-y-2">
                  <div className="flex justify-between"><dt className="text-muted">Status</dt><dd><StatusPill status={status} /></dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Priority</dt><dd><StatusPill status={priority} /></dd></div>
                  <div className="flex justify-between"><dt className="text-muted">Agent</dt><dd className="font-medium">{byId(agent)?.name ?? "Unassigned"}</dd></div>
                </dl>
              ) : (
                <>
              <label className="block">
                <span className="lbl">Status</span>
                <select
                  className="input"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as typeof status);
                    patch({ status: e.target.value });
                    push("Status updated");
                  }}
                >
                  {["Open", "Pending", "Resolved", "Closed"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="lbl">Priority</span>
                <select
                  className="input"
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value as typeof priority);
                    patch({ priority: e.target.value });
                    push("Priority updated");
                  }}
                >
                  {["High", "Medium", "Low"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="lbl">Assigned agent</span>
                <select
                  className="input"
                  value={agent}
                  onChange={(e) => {
                    setAgent(e.target.value);
                    patch({ agent: e.target.value });
                    push(`Assigned to ${byId(e.target.value)?.name}`);
                  }}
                >
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
                </>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 font-display text-[15px] font-bold">SLA</h3>
            <p className="flex items-center gap-2 text-sm">
              <Timer size={15} className={priority === "High" ? "text-bad" : "text-good"} />
              First response due in <b>{slaHours}h</b>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <span
                className={clsx("block h-full rounded-full", priority === "High" ? "bg-bad" : "bg-good")}
                style={{ width: priority === "High" ? "78%" : "34%" }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">Policy based on <b>{priority}</b> priority.</p>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 font-display text-[15px] font-bold">Requester</h3>
            <AvatarName
              name={ticket.requester}
              sub={client?.company ?? staffRequester?.designation ?? "Requester"}
              size={38}
            />
            <dl className="mt-3.5 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Email</dt>
                {/* Not every ticket comes from a client: colleagues raise them too. */}
                <dd className="font-medium">{client?.email ?? staffRequester?.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between"><dt className="text-muted">Group</dt><dd className="font-medium">{ticket.group}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Type</dt><dd className="font-medium">{ticket.type}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Last activity</dt><dd className="font-medium">{fmtDate(ticket.updated)}</dd></div>
            </dl>
            {client && (
              <button className="btn-outline mt-3.5 w-full py-1.5 text-xs" onClick={() => nav(`/clients/${client.id}`)}>
                <UserCog size={13} /> Open client record
              </button>
            )}
          </div>

          <div className="card p-5">
            <h3 className="mb-2.5 flex items-center gap-2 font-display text-[15px] font-bold">
              <Tag size={14} /> Summary
            </h3>
            <div className="flex flex-wrap gap-2 text-sm">
              <StatusPill status={status} />
              <StatusPill status={priority} />
              <span className="flex items-center gap-1 rounded-full bg-page px-2.5 py-1 text-xs font-medium text-muted">
                <Clock size={11} /> Opened {fmtDate(ticket.updated)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
