/* Unified approvals queue — everything waiting on a manager in one place:
   leave requests, expense claims, overtime, timesheets and estimates. */
import clsx from "clsx";
import { Check, Clock3, Inbox, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { AvatarName, StatusPill, Tabs } from "@/components/ui";
import { byId } from "@/data/core";
import { estimates, expenses } from "@/data/finance";
import { leaves } from "@/data/hr";
import { overtimeRequests } from "@/data/people2";
import { tasks, timeLogs } from "@/data/work";
import { api, decideLeave } from "@/lib/api";
import { fmtDate, money } from "@/lib/format";
import { useToast } from "@/lib/store";

type Item = {
  id: string;
  kind: "Leave" | "Expense" | "Overtime" | "Timesheet" | "Estimate";
  who: string;
  title: string;
  detail: string;
  amount?: string;
  date: string;
  collection: string;
  recordId: string | number;
  approvePatch: Record<string, unknown>;
  rejectPatch: Record<string, unknown>;
  to?: string;
};

const KIND_TONE: Record<string, string> = {
  Leave: "warn", Expense: "good", Overtime: "info", Timesheet: "muted", Estimate: "info",
};

export default function Approvals() {
  const { push } = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState("All");
  const [handled, setHandled] = useState<Record<string, "Approved" | "Rejected">>({});

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    leaves.filter((l) => l.status === "Pending").forEach((l) =>
      out.push({
        id: `leave-${l.id}`, kind: "Leave", who: byId(l.employee)?.name ?? "—",
        title: `${l.type} leave · ${l.duration}`, detail: l.reason || "No reason given",
        date: l.date, collection: "leaves", recordId: l.id,
        approvePatch: { status: "Approved" }, rejectPatch: { status: "Rejected" }, to: "/hr/leaves",
      })
    );
    expenses.filter((e) => e.status === "Pending").forEach((e) =>
      out.push({
        id: `exp-${e.id}`, kind: "Expense", who: byId(e.employee)?.name ?? "—",
        title: e.item, detail: `${e.category} · purchased ${fmtDate(e.date)}`, amount: money(e.price),
        date: e.date, collection: "expenses", recordId: e.id,
        approvePatch: { status: "Approved" }, rejectPatch: { status: "Rejected" }, to: "/finance/expenses",
      })
    );
    overtimeRequests.filter((o) => o.status === "Pending").forEach((o) =>
      out.push({
        id: `ot-${o.id}`, kind: "Overtime", who: byId(o.employee)?.name ?? "—",
        title: `${o.hours} hours overtime`, detail: o.reason,
        date: o.date, collection: "overtimeRequests", recordId: o.id,
        approvePatch: { status: "Approved" }, rejectPatch: { status: "Rejected" }, to: "/payroll",
      })
    );
    timeLogs.slice(0, 3).forEach((t) =>
      out.push({
        id: `ts-${t.id}`, kind: "Timesheet", who: byId(t.employee)?.name ?? "—",
        title: `${t.hours}h on ${tasks.find((x) => x.id === t.taskId)?.code ?? "task"}`,
        detail: t.memo, amount: money(t.hours * (byId(t.employee)?.hourly ?? 0)),
        date: t.start.slice(0, 10), collection: "timeLogs", recordId: t.id,
        approvePatch: { approved: true }, rejectPatch: { approved: false }, to: "/work/timesheets",
      })
    );
    estimates.filter((e) => e.status === "Sent").forEach((e) =>
      out.push({
        id: `est-${e.id}`, kind: "Estimate", who: "Client decision", title: e.number,
        detail: `Awaiting client approval · valid to ${fmtDate(e.valid)}`, amount: money(e.total),
        date: e.date, collection: "estimates", recordId: e.id,
        approvePatch: { status: "Accepted" }, rejectPatch: { status: "Declined" }, to: "/finance/estimates",
      })
    );
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  const pending = items.filter((i) => !handled[i.id]);
  const rows = tab === "All" ? pending : pending.filter((i) => i.kind === tab);

  /* Leave has its own endpoint rather than a status edit: the server moves the
     days from pending to used under a row lock and records who decided it.
     There is no PATCH on /leave at all, so approving one from here used to 404
     while the row went grey as though it had worked. Everything else on this
     screen really is a status change. */
  const decide = async (item: Item, ok: boolean) => {
    setHandled((h) => ({ ...h, [item.id]: ok ? "Approved" : "Rejected" }));

    const landed =
      item.collection === "leaves"
        ? await decideLeave(String(item.recordId), ok ? "APPROVED" : "REJECTED")
        : await api.outcome(
            api.update(item.collection, item.recordId, ok ? item.approvePatch : item.rejectPatch)
          );

    if (!landed) {
      // Put it back on the list — the decision did not take. The API layer has
      // already said why.
      setHandled((h) => {
        const next = { ...h };
        delete next[item.id];
        return next;
      });
      return;
    }
    push(`${item.kind} ${ok ? "approved" : "rejected"} — ${item.who}`);
  };

  const bulk = (ok: boolean) => {
    if (rows.length === 0) return push("Nothing to action");
    rows.forEach((r) => void decide(r, ok));
  };

  const counts = (k: string) => pending.filter((i) => i.kind === k).length;

  return (
    <>
      <PageHeader
        title="Approvals"
        actions={
          <>
            <button className="btn-outline" onClick={() => bulk(false)}>
              <X size={15} /> Reject all shown
            </button>
            <button className="btn-primary" onClick={() => bulk(true)}>
              <Check size={15} /> Approve all shown
            </button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting you" value={pending.length} icon={Inbox} sub="across all modules" />
        <StatCard label="Leave requests" value={counts("Leave")} />
        <StatCard label="Expense claims" value={counts("Expense")} />
        <StatCard label="Handled today" value={Object.keys(handled).length} icon={Check} />
      </div>

      <div className="card mb-5 px-2">
        <Tabs
          tabs={["All", "Leave", "Expense", "Overtime", "Timesheet", "Estimate"].map((t) =>
            t === "All" ? `All (${pending.length})` : `${t} (${counts(t)})`
          )}
          active={tab === "All" ? `All (${pending.length})` : `${tab} (${counts(tab)})`}
          onChange={(t) => setTab(t.split(" (")[0])}
          className="border-b-0"
        />
      </div>

      <div className="space-y-3">
        {rows.map((item) => (
          <div key={item.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
            <StatusPill status={item.kind} tone={KIND_TONE[item.kind]} />
            <div className="min-w-52 flex-1">
              <p className="font-semibold">{item.title}</p>
              <p className="text-xs text-muted">{item.detail}</p>
            </div>
            {item.who !== "Client decision" ? (
              <AvatarName name={item.who} size={30} />
            ) : (
              <span className="text-xs font-medium text-muted">{item.who}</span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Clock3 size={12} /> {fmtDate(item.date)}
            </span>
            {item.amount && <span className="font-display text-[15px] font-bold tabular-nums">{item.amount}</span>}
            <span className="flex gap-2">
              <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => decide(item, true)}>
                <Check size={13} /> Approve
              </button>
              <button className="btn-outline px-3 py-1.5 text-xs text-bad" onClick={() => decide(item, false)}>
                <X size={13} /> Reject
              </button>
              {item.to && (
                <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => nav(item.to!)}>
                  Open
                </button>
              )}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="card flex flex-col items-center gap-2 p-14 text-sm text-faint">
            <Inbox size={28} />
            Nothing waiting on you — inbox zero 🎉
          </div>
        )}
      </div>

      {Object.keys(handled).length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-bold tracking-wider text-faint uppercase">Handled in this session</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(handled).map(([id, verdict]) => {
              const it = items.find((i) => i.id === id);
              return (
                <span
                  key={id}
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    verdict === "Approved" ? "bg-good-soft text-good" : "bg-bad-soft text-bad"
                  )}
                >
                  {verdict}: {it?.title}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
