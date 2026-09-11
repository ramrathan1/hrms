/* Onboarding & offboarding checklists — track every step for joiners and leavers,
   with owners, due dates and completion progress. */
import clsx from "clsx";
import { CheckCircle2, Plus, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { FormModal } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Avatar, AvatarName, StatusPill, Tabs } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { api } from "@/lib/api";
import { fmtDate, todayISO } from "@/lib/format";
import { CURRENT_USER, useToast } from "@/lib/store";

type Step = { id: string; label: string; owner: string; done: boolean };
type Journey = {
  id: string;
  employee: string;
  kind: "Onboarding" | "Offboarding";
  startDate: string;
  steps: Step[];
};

const ONBOARD_TEMPLATE = [
  ["Send offer letter & contract", "e10"],
  ["Collect ID & tax documents", "e10"],
  ["Create email + system accounts", CURRENT_USER.id],
  ["Assign laptop and peripherals", CURRENT_USER.id],
  ["Add to payroll", "e10"],
  ["Schedule buddy & team intro", "e3"],
  ["First-week goals set with manager", "e3"],
] as const;

const OFFBOARD_TEMPLATE = [
  ["Confirm resignation & last working day", "e10"],
  ["Knowledge handover document", "e3"],
  ["Revoke system access", CURRENT_USER.id],
  ["Collect company assets", CURRENT_USER.id],
  ["Final settlement & payslip", "e10"],
  ["Exit interview", "e10"],
] as const;

const makeSteps = (t: readonly (readonly [string, string])[]): Step[] =>
  t.map(([label, owner], i) => ({ id: `s${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label, owner, done: false }));

export default function Onboarding() {
  const { push } = useToast();
  const [tab, setTab] = useState("Onboarding");
  const [newOpen, setNewOpen] = useState(false);
  const [journeys, setJourneys] = useState<Journey[]>([
    { id: "j1", employee: "e8", kind: "Onboarding", startDate: "2026-08-24", steps: makeSteps(ONBOARD_TEMPLATE).map((s, i) => ({ ...s, done: i < 4 })) },
    { id: "j2", employee: "e5", kind: "Onboarding", startDate: "2026-08-28", steps: makeSteps(ONBOARD_TEMPLATE).map((s, i) => ({ ...s, done: i < 2 })) },
    { id: "j3", employee: "e7", kind: "Offboarding", startDate: "2026-08-20", steps: makeSteps(OFFBOARD_TEMPLATE).map((s, i) => ({ ...s, done: i < 5 })) },
  ]);

  const rows = journeys.filter((j) => j.kind === tab);
  const pct = (j: Journey) => Math.round((j.steps.filter((s) => s.done).length / j.steps.length) * 100);

  const toggle = (jid: string, sid: string) => {
    setJourneys((js) =>
      js.map((j) =>
        j.id === jid ? { ...j, steps: j.steps.map((s) => (s.id === sid ? { ...s, done: !s.done } : s)) } : j
      )
    );
    void api.update("journeys", jid, { updated: todayISO() });
  };

  return (
    <>
      <PageHeader
        title="Onboarding & Offboarding"
        crumbs={["HR"]}
        actions={
          <button className="btn-primary" onClick={() => setNewOpen(true)}>
            <Plus size={15} /> Start a checklist
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Joiners in progress" value={journeys.filter((j) => j.kind === "Onboarding" && pct(j) < 100).length} icon={UserPlus} />
        <StatCard label="Leavers in progress" value={journeys.filter((j) => j.kind === "Offboarding" && pct(j) < 100).length} icon={UserMinus} />
        <StatCard label="Steps outstanding" value={journeys.reduce((a, j) => a + j.steps.filter((s) => !s.done).length, 0)} />
        <StatCard label="Completed journeys" value={journeys.filter((j) => pct(j) === 100).length} icon={CheckCircle2} />
      </div>

      <div className="card mb-5 px-2">
        <Tabs tabs={["Onboarding", "Offboarding"]} active={tab} onChange={setTab} className="border-b-0" />
      </div>

      <div className="space-y-4">
        {rows.map((j) => {
          const done = pct(j);
          return (
            <div key={j.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-4">
                <AvatarName name={byId(j.employee)?.name ?? "—"} sub={byId(j.employee)?.designation} size={38} />
                <span className="text-xs text-muted">
                  {j.kind === "Onboarding" ? "Joined" : "Leaving"} {fmtDate(j.startDate)}
                </span>
                <span className="ml-auto flex items-center gap-3">
                  <span className="h-1.5 w-32 overflow-hidden rounded-full bg-line">
                    <span
                      className={clsx("block h-full rounded-full", done === 100 ? "bg-good" : "bg-primary")}
                      style={{ width: `${done}%` }}
                    />
                  </span>
                  <StatusPill status={done === 100 ? "Complete" : `${done}%`} tone={done === 100 ? "good" : done > 50 ? "info" : "warn"} />
                </span>
              </div>
              <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                {j.steps.map((s) => (
                  <li
                    key={s.id}
                    className={clsx(
                      "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm",
                      s.done ? "border-good/25 bg-good-soft/50" : "border-line bg-white/70"
                    )}
                  >
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={s.done} onChange={() => toggle(j.id, s.id)} />
                    <span className={clsx("flex-1", s.done && "text-muted line-through")}>{s.label}</span>
                    <span title={byId(s.owner)?.name}>
                      <Avatar name={byId(s.owner)?.name ?? "?"} size={22} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="card p-12 text-center text-sm text-faint">
            No {tab.toLowerCase()} checklists running — start one above.
          </div>
        )}
      </div>

      <FormModal
        open={newOpen}
        title="Start a checklist"
        fields={[
          { key: "employee", label: "Employee", type: "select", options: employees.map((e) => ({ value: e.id, label: `${e.name} — ${e.designation}` })), required: true },
          { key: "kind", label: "Checklist type", type: "select", options: ["Onboarding", "Offboarding"] },
          { key: "startDate", label: "Start / last working day", type: "date", required: true },
        ]}
        initial={{ kind: tab, startDate: "2026-09-01" }}
        submitLabel="Create checklist"
        onSubmit={(v) => {
          const kind = v.kind as Journey["kind"];
          const j: Journey = {
            id: `j-${Date.now()}`,
            employee: String(v.employee),
            kind,
            startDate: String(v.startDate),
            steps: makeSteps(kind === "Onboarding" ? ONBOARD_TEMPLATE : OFFBOARD_TEMPLATE),
          };
          setJourneys((js) => [j, ...js]);
          void api.create("journeys", j);
          setTab(kind);
          push(`${kind} checklist started for ${byId(j.employee)?.name}`);
          setNewOpen(false);
        }}
        onClose={() => setNewOpen(false)}
      />
    </>
  );
}
