import clsx from "clsx";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Gantt } from "@/components/Gantt";
import { Kanban } from "@/components/Kanban";
import { ChartCard, StatCard } from "@/components/StatCard";
import { LineChart, Donut } from "@/components/charts";
import { Avatar, AvatarName, Modal, Progress, StatusPill, Tabs } from "@/components/ui";
import { FileBarChart, GanttChartSquare, Kanban as KanbanIcon, Plus, UserPlus } from "lucide-react";
import { Attachments, CommentThread, type CommentItem, type FileItem } from "@/components/RecordPanels";
import { FormModal, useCrud } from "@/components/crud";
import { byId, clientById, employees } from "@/data/core";
import { expenses, invoices } from "@/data/finance";
import { discussions, milestones, projectById, projectFiles, projects, tasks as taskSeed, timeLogs } from "@/data/work";
import { api } from "@/lib/api";
import { fmtDate, money, todayISO } from "@/lib/format";
import { CURRENT_USER, useToast } from "@/lib/store";

const TABS = ["Overview", "Members", "Files", "Milestones", "Tasks", "Task Board", "Burndown Chart", "Discussion"];
const BOARD_COLS = [
  { id: "Incomplete", title: "Incomplete", color: "#e85d51" },
  { id: "Todo", title: "To Do", color: "#e8983c" },
  { id: "Doing", title: "Doing", color: "#3fa9f5" },
  { id: "Completed", title: "Completed", color: "#1fa971" },
];

export default function ProjectDetail() {
  const { id } = useParams();
  /* Non-null by construction: the route wraps this page in RequireRecord,
     which only renders it once the record is in the store. */
  const project = projectById(id)!;
  const [tab, setTab] = useState("Overview");
  const [boardView, setBoardView] = useState<"board" | "gantt">("board");
  const [items, setItems] = useState(taskSeed);
  const { push } = useToast();
  const nav = useNavigate();
  const [members, setMembers] = useState<string[]>(project.members);
  const [addMember, setAddMember] = useState("");
  const [thread, setThread] = useState<(typeof discussions)[number] | null>(null);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [threadComments, setThreadComments] = useState<Record<string, CommentItem[]>>({});
  const [files, setFiles] = useState<FileItem[]>(() =>
    projectFiles
      .filter((f) => f.projectId === project.id)
      .map((f) => ({ id: f.id, name: f.name, size: f.size, by: byId(f.by)?.name ?? f.by, date: f.date }))
  );
  const milestoneCrud = useCrud({
    collection: "milestones",
    seed: milestones,
    itemName: "Milestone",
    withView: false,
    fields: [
      { key: "title", label: "Milestone", required: true, span: true },
      { key: "cost", label: "Cost", type: "number" },
      { key: "tasks", label: "Tasks", type: "number" },
      { key: "due", label: "End date", type: "date", required: true },
      { key: "status", label: "Status", type: "select", options: ["Not Started", "In Progress", "Complete"] },
    ],
    defaults: { projectId: project.id, status: "Not Started", cost: 0, tasks: 0 } as never,
  });
  const pMilestones = milestoneCrud.items.filter((m) => m.projectId === project.id);

  const pTasks = items.filter((t) => t.projectId === project.id);
  const done = pTasks.filter((t) => t.status === "Completed").length;

  /* budget vs actual: labour from time logs at each person's rate, plus expenses */
  const pTaskIds = new Set(pTasks.map((t) => t.id));
  const pLogs = timeLogs.filter((l) => pTaskIds.has(l.taskId));
  const hours = Math.round(pLogs.reduce((a, l) => a + l.hours, 0) + pTasks.reduce((a, t) => a + t.hours, 0));
  const labour = Math.round(
    pLogs.reduce((a, l) => a + l.hours * (byId(l.employee)?.hourly ?? 0), 0) +
      pTasks.reduce((a, t) => a + t.hours * (byId(t.assignees[0])?.hourly ?? 60), 0)
  );
  const projectExpenses = expenses
    .filter((e) => e.project === project.name && e.status !== "Rejected")
    .reduce((a, e) => a + e.price, 0);
  const spent = labour + projectExpenses;
  const burnPct = project.budget > 0 ? Math.round((spent / project.budget) * 100) : 0;
  const pInvoices = invoices.filter((i) => i.projectId === project.id);
  const invoiced = pInvoices.reduce((a, i) => a + i.total, 0);
  const collected = pInvoices.reduce((a, i) => a + i.paid, 0);
  return (
    <>
      <PageHeader title={project.name} crumbs={["Work", "Projects"]} />
      <div className="card mb-5 flex flex-wrap items-center gap-2 px-2">
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="border-b-0" />
        <button className="btn-outline my-1.5 ml-auto mr-2 px-3 py-1.5 text-xs" onClick={() => nav(`/work/projects/${project.id}/report`)}>
          <FileBarChart size={13} /> Client progress report
        </button>
      </div>

      {tab === "Overview" && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Project Budget" value={money(project.budget)} />
            <StatCard label="Spent to date" value={money(spent)} sub={`${burnPct}% of budget`} trend={{ value: `${burnPct}%`, up: burnPct <= project.progress }} />
            <StatCard label="Invoiced" value={money(invoiced)} sub={`${money(collected)} collected`} />
            <StatCard label="Margin" value={money(invoiced - spent)} sub={invoiced > 0 ? `${Math.round(((invoiced - spent) / invoiced) * 100)}% of invoiced` : "not invoiced yet"} trend={{ value: invoiced - spent >= 0 ? "profitable" : "over", up: invoiced - spent >= 0 }} />
          </div>

          {/* budget burn vs progress */}
          <div className="card mb-5 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-[15px] font-bold">Budget burn vs delivery progress</h3>
              <span className={clsx("text-xs font-semibold", burnPct > project.progress + 10 ? "text-bad" : "text-good")}>
                {burnPct > project.progress + 10
                  ? `Burning faster than delivery — ${burnPct - project.progress}pt gap`
                  : "Burn is tracking delivery"}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { label: "Budget spent", value: burnPct, color: burnPct > project.progress + 10 ? "bg-bad" : "bg-primary", right: `${money(spent)} of ${money(project.budget)}` },
                { label: "Work completed", value: project.progress, color: "bg-good", right: `${done}/${pTasks.length} tasks` },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-muted">{row.label}</span>
                    <span className="tabular-nums text-muted">{row.right}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line">
                    <div className={clsx("h-full rounded-full transition-all", row.color)} style={{ width: `${Math.min(row.value, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm md:grid-cols-4">
              <div><dt className="text-xs text-muted">Labour cost</dt><dd className="font-semibold tabular-nums">{money(labour)}</dd></div>
              <div><dt className="text-xs text-muted">Expenses</dt><dd className="font-semibold tabular-nums">{money(projectExpenses)}</dd></div>
              <div><dt className="text-xs text-muted">Remaining budget</dt><dd className={clsx("font-semibold tabular-nums", project.budget - spent < 0 && "text-bad")}>{money(project.budget - spent)}</dd></div>
              <div><dt className="text-xs text-muted">Hours logged</dt><dd className="font-semibold tabular-nums">{hours}h</dd></div>
            </dl>
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="card p-6 xl:col-span-2">
              <h3 className="mb-3 font-semibold">Project Details</h3>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3.5 text-sm md:grid-cols-2">
                {[
                  ["Project Code", project.code],
                  ["Client", clientById(project.clientId)?.company ?? "—"],
                  ["Start Date", fmtDate(project.start)],
                  ["Deadline", fmtDate(project.deadline)],
                  ["Category", project.category],
                  ["Status", project.status],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-5 border-b border-line pb-2.5">
                    <dt className="w-28 shrink-0 text-muted">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm text-muted">Progress</span>
                <Progress value={project.progress} />
              </div>
            </div>
            <ChartCard title="Tasks">
              <Donut
                size={170}
                centerLabel="tasks"
                segments={[
                  { label: "Completed", value: done, color: "#1fa971" },
                  { label: "Doing", value: pTasks.filter((t) => t.status === "Doing").length, color: "#3fa9f5" },
                  { label: "To Do", value: pTasks.filter((t) => t.status === "Todo").length, color: "#e8983c" },
                  { label: "Incomplete", value: pTasks.filter((t) => t.status === "Incomplete").length, color: "#e85d51" },
                ]}
              />
            </ChartCard>
          </div>
        </>
      )}

      {tab === "Members" && (
        <>
          <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
            <label className="min-w-56 flex-1">
              <span className="lbl">Add a member to this project</span>
              <select className="input" value={addMember} onChange={(e) => setAddMember(e.target.value)}>
                <option value="">Select an employee…</option>
                {employees.filter((e) => !members.includes(e.id)).map((e) => (
                  <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>
                ))}
              </select>
            </label>
            <button
              className="btn-primary"
              onClick={() => {
                if (!addMember) return;
                const next = [...members, addMember];
                setMembers(next);
                project.members = next;
                void api.update("projects", project.id, { members: next });
                push(`${byId(addMember)?.name} added to ${project.code}`);
                setAddMember("");
              }}
            >
              <UserPlus size={15} /> Add member
            </button>
          </div>
          <DataTable
            rows={members.map((m) => ({ id: m }))}
            selectable={false}
            columns={[
              { key: "name", label: "Name", render: (r) => <AvatarName name={byId(r.id)?.name ?? r.id} sub={byId(r.id)?.designation} /> },
              { key: "dept", label: "Department", render: (r) => byId(r.id)?.department },
              { key: "hourly", label: "Hourly Rate", render: (r) => money(byId(r.id)?.hourly ?? 0) },
              { key: "role", label: "Project Role", render: (r) => (r.id === (project.members ?? [])[0] ? "Project Admin" : "Member") },
              { key: "tasks", label: "Open tasks", render: (r) => pTasks.filter((t) => t.assignees.includes(r.id) && t.status !== "Completed").length, className: "tabular-nums" },
            ]}
            rowActions={(r) => [
              { label: "View profile", onClick: () => window.location.assign(`/hr/employees/${r.id}`) },
              {
                label: "Remove from project",
                danger: true,
                onClick: () => {
                  const next = members.filter((m) => m !== r.id);
                  setMembers(next);
                  project.members = next;
                  void api.update("projects", project.id, { members: next });
                  push(`${byId(r.id)?.name} removed`);
                },
              },
            ]}
            emptyText="No members yet — add someone above"
          />
        </>
      )}

      {tab === "Files" && (
        <div className="card p-5">
          <Attachments
            files={files}
            onAdd={(f) => setFiles((fs) => [...fs, f])}
            onRemove={(fid) => setFiles((fs) => fs.filter((x) => x.id !== fid))}
            collection="projects"
            recordId={project.id}
          />
        </div>
      )}

      {tab === "Milestones" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div>
              <p className="text-sm font-semibold">
                {pMilestones.filter((m) => m.status === "Complete").length} of {pMilestones.length} complete
              </p>
              <p className="text-xs text-muted">
                Milestones bill the client and mark the phases of {project.code}.
              </p>
            </div>
            <span className="ml-auto text-sm text-muted tabular-nums">
              {money(pMilestones.reduce((a, m) => a + Number(m.cost ?? 0), 0))} total
            </span>
            <button className="btn-primary" onClick={milestoneCrud.openNew}>
              <Plus size={15} /> Add milestone
            </button>
          </div>
          <DataTable
            rows={pMilestones}
            selectable={false}
            columns={[
              { key: "title", label: "Milestone", render: (m) => <span className="font-medium">{m.title}</span> },
              { key: "cost", label: "Cost", render: (m) => money(Number(m.cost ?? 0)) },
              { key: "tasks", label: "Tasks", className: "tabular-nums" },
              { key: "due", label: "End Date", render: (m) => fmtDate(m.due) },
              { key: "status", label: "Status", render: (m) => <StatusPill status={m.status} /> },
            ]}
            rowActions={(m) => milestoneCrud.rowActions(m)}
            emptyText="No milestones yet — add the first phase of this project"
          />
          {milestoneCrud.modals}
        </>
      )}

      {tab === "Tasks" && (
        <DataTable
          rows={pTasks}
          columns={[
            { key: "code", label: "Code" },
            { key: "title", label: "Task", sort: (t) => t.title, render: (t) => <span className="font-medium">{t.title}</span> },
            { key: "assignees", label: "Assigned To", render: (t) => <span className="flex -space-x-1.5">{t.assignees.map((a) => <Avatar key={a} name={byId(a)?.name ?? a} size={26} />)}</span> },
            { key: "due", label: "Due Date", sort: (t) => t.due, render: (t) => <span className={t.due < todayISO() && t.status !== "Completed" ? "text-bad" : ""}>{fmtDate(t.due)}</span> },
            { key: "status", label: "Status", render: (t) => <StatusPill status={t.status} /> },
          ]}
          rowActions={() => [{ label: "View" }, { label: "Edit" }, { label: "Delete", danger: true }]}
        />
      )}

      {/* Board and Gantt are the same tasks seen two ways, so they share one tab. */}
      {tab === "Task Board" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-line bg-white p-0.5">
              {([["board", "Board", KanbanIcon], ["gantt", "Timeline", GanttChartSquare]] as const).map(([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => setBoardView(v)}
                  aria-pressed={boardView === v}
                  className={clsx(
                    "btn cursor-pointer gap-1.5 px-3 py-1.5 text-sm font-medium",
                    boardView === v ? "bg-primary-soft text-primary" : "text-muted hover:text-ink"
                  )}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">
              {boardView === "board"
                ? "Drag a card between columns to change its status."
                : "Drag a bar's right edge to reschedule the due date."}
            </p>
            <span className="ml-auto text-sm text-muted tabular-nums">
              {done}/{pTasks.length} complete
            </span>
          </div>

          {boardView === "board" ? (
            <Kanban
              columns={BOARD_COLS}
              items={pTasks}
              columnOf={(t) => t.status}
              onMove={(tid, col) => {
                setItems((its) => its.map((t) => (t.id === tid ? { ...t, status: col as never } : t)));
                api.update("tasks", tid, { status: col });
                push("Task status updated");
              }}
              renderCard={(t) => (
                <>
                  <p className="text-xs text-faint">{t.code}</p>
                  <p className="mt-0.5 text-sm font-semibold">{t.title}</p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <StatusPill status={t.priority} />
                    <span className="flex -space-x-1.5">{t.assignees.map((a) => <Avatar key={a} name={byId(a)?.name ?? a} size={22} />)}</span>
                  </div>
                </>
              )}
            />
          ) : (
            <ChartCard title={`Timeline — ${project.code}`}>
              <Gantt
                from={project.start}
                to={project.deadline}
                rows={pTasks.map((t) => ({
                  id: t.id,
                  label: `${t.code} ${t.title}`,
                  start: project.start,
                  end: t.due,
                  status: t.status,
                }))}
                onReschedule={(id, _start, end) => {
                  const t = pTasks.find((x) => x.id === id);
                  setItems((its) => its.map((x) => (x.id === id ? { ...x, due: end } : x)));
                  const seedRow = taskSeed.find((x) => x.id === id);
                  if (seedRow) seedRow.due = end;
                  void api.update("tasks", id, { due: end });
                  push(`${t?.code ?? "Task"} rescheduled to ${fmtDate(end)}`);
                }}
              />
            </ChartCard>
          )}
        </>
      )}

      {tab === "Burndown Chart" && (
        <ChartCard title="Burndown — remaining tasks">
          <LineChart
            points={[pTasks.length, pTasks.length - 1, pTasks.length - 1, pTasks.length - 2, Math.max(pTasks.length - done, 0)]}
            labels={["Week 1", "Week 2", "Week 3", "Week 4", "Now"]}
            color="#e85d51"
          />
        </ChartCard>
      )}

      {tab === "Discussion" && (
        <div className="space-y-4">
          {discussions.filter((d) => d.projectId === project.id).map((d) => (
            <div key={d.id} className="card flex items-center gap-4 px-5 py-4">
              <Avatar name={byId(d.author)?.name ?? "?"} size={38} />
              <div>
                <p className="font-semibold">{d.title}</p>
                <p className="text-xs text-muted">{byId(d.author)?.name} · {fmtDate(d.date)} · {d.replies} replies</p>
              </div>
              <button className="btn-outline ml-auto px-3 py-1.5 text-xs" onClick={() => setThread(d)}>Open</button>
            </div>
          ))}
          {discussions.filter((d) => d.projectId === project.id).length === 0 && (
            <div className="card p-10 text-center text-sm text-faint">No discussions started</div>
          )}
          <button className="btn-primary" onClick={() => setNewThreadOpen(true)}>
            <Plus size={15} /> Start a discussion
          </button>
        </div>
      )}

      {/* discussion thread */}
      <Modal open={thread !== null} onClose={() => setThread(null)} title={thread?.title ?? ""} wide>
        {thread && (
          <>
            <p className="mb-4 text-xs text-muted">
              Started by {byId(thread.author)?.name} · {fmtDate(thread.date)} · {project.name}
            </p>
            <CommentThread
              comments={threadComments[thread.id] ?? [
                { id: "seed", by: byId(thread.author)?.name ?? "Team", text: `Opening this thread so we can settle ${thread.title.toLowerCase()} before the next sprint.`, time: "10:20 AM" },
              ]}
              onAdd={(c) =>
                setThreadComments((tc) => ({
                  ...tc,
                  [thread.id]: [
                    ...(tc[thread.id] ?? [
                      { id: "seed", by: byId(thread.author)?.name ?? "Team", text: `Opening this thread so we can settle ${thread.title.toLowerCase()} before the next sprint.`, time: "10:20 AM" },
                    ]),
                    c,
                  ],
                }))
              }
              placeholder="Reply to the team…"
            />
          </>
        )}
      </Modal>

      <FormModal
        open={newThreadOpen}
        title="Start a discussion"
        fields={[
          { key: "title", label: "Topic", required: true, span: true, placeholder: "e.g. Scope for the RBAC phase" },
          { key: "body", label: "Opening message", type: "textarea", required: true },
        ]}
        submitLabel="Post discussion"
        onSubmit={(v) => {
          const d = { id: `ds-${Date.now()}`, projectId: project.id, author: CURRENT_USER.id, date: todayISO(), title: String(v.title), replies: 0 };
          discussions.push(d);
          void api.create("discussions", d);
          setThreadComments((tc) => ({ ...tc, [d.id]: [{ id: "c0", by: "Mohammed Ziemann", text: String(v.body), time: "now" }] }));
          push("Discussion started");
          setNewThreadOpen(false);
          setThread(d);
        }}
        onClose={() => setNewThreadOpen(false)}
      />
    </>
  );
}
