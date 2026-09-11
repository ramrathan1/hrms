import clsx from "clsx";
import {
  CalendarDays, ChevronDown, Clock, GitBranch, Kanban as KanbanIcon, List, ListChecks,
  MoreHorizontal, Plus, Send, Star, X,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarMonth } from "@/components/CalendarMonth";
import { FormModal, useCrud, type RowAction } from "@/components/crud";
import { Kanban } from "@/components/Kanban";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { Avatar, AvatarName, Dropdown, SearchInput, Select, StatusPill } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { projects, tasks as seed } from "@/data/work";
import { fmtDate, todayISO } from "@/lib/format";
import { CURRENT_USER, useToast } from "@/lib/store";
import { useTimer } from "@/lib/timer";

type Task = (typeof seed)[number];

/* `id` is the status as it is stored — the API's TaskStatus, title-cased.
   `title` is what the column heading says. They differ for Todo, and keeping
   them apart is what stops the board writing a status the server rejects. */
const GROUPS = [
  { id: "Incomplete", title: "Incomplete", color: "#e5554a" },
  { id: "Todo", title: "To Do", color: "#e8983c" },
  { id: "Doing", title: "Doing", color: "#3f9af5" },
  { id: "Completed", title: "Completed", color: "#16a066" },
];

/* ---------------- ClickUp-style task detail drawer ---------------- */
function TaskDrawer({
  task,
  siblings,
  onClose,
  onChange,
}: {
  task: Task;
  siblings: Task[];
  onClose: () => void;
  onChange: (patch: Partial<Task>) => void;
}) {
  const [subtasks, setSubtasks] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [subDraft, setSubDraft] = useState("");
  const [blockedBy, setBlockedBy] = useState<string>((task as Task & { blockedBy?: string }).blockedBy ?? "");
  const [comments, setComments] = useState<{ by: string; text: string; time: string }[]>([
    { by: byId(task.assignees[0])?.name ?? "System", text: `changed the status of "${task.title}" to ${task.status}`, time: "10:45 AM" },
  ]);
  const [draft, setDraft] = useState("");
  const project = projects.find((p) => p.id === task.projectId);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/25 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-white/95 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <button className="btn-ghost -ml-2 px-2 py-1.5" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
          <span className="flex items-center gap-1 text-faint">
            <Clock size={15} /> <Star size={15} /> <MoreHorizontal size={15} />
          </span>
        </div>
        <div className="px-6 pb-6">
          <h2 className="mt-2 font-display text-xl font-bold">{task.title}</h2>
          <dl className="mt-5 space-y-3.5 text-sm">
            <div className="flex items-center gap-6">
              <dt className="w-28 shrink-0 text-muted">Created time</dt>
              <dd className="font-medium">August 29, 2026 · 10:35 AM</dd>
            </div>
            <div className="flex items-center gap-6">
              <dt className="w-28 shrink-0 text-muted">Status</dt>
              <dd>
                <select
                  className="input w-auto py-1 text-xs font-semibold"
                  value={task.status}
                  onChange={(e) => onChange({ status: e.target.value as Task["status"] })}
                >
                  {GROUPS.map((g) => <option key={g.id}>{g.id}</option>)}
                </select>
              </dd>
            </div>
            <div className="flex items-center gap-6">
              <dt className="w-28 shrink-0 text-muted">Priority</dt>
              <dd>
                <select
                  className="input w-auto py-1 text-xs font-semibold"
                  value={task.priority}
                  onChange={(e) => onChange({ priority: e.target.value as Task["priority"] })}
                >
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </dd>
            </div>
            <div className="flex items-center gap-6">
              <dt className="w-28 shrink-0 text-muted">Due Date</dt>
              <dd>
                <input
                  type="date"
                  className="input w-auto py-1 text-xs font-semibold"
                  value={task.due}
                  onChange={(e) => onChange({ due: e.target.value })}
                />
              </dd>
            </div>
            <div className="flex items-center gap-6">
              <dt className="w-28 shrink-0 text-muted">Tags</dt>
              <dd className="flex gap-1.5">
                <span className="rounded-full bg-page px-2.5 py-1 text-xs font-medium">{task.code}</span>
                {task.label && <span className="rounded-full bg-page px-2.5 py-1 text-xs font-medium">{task.label}</span>}
                {project && <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">{project.code}</span>}
              </dd>
            </div>
            <div className="flex items-center gap-6">
              <dt className="w-28 shrink-0 text-muted">Assignees</dt>
              <dd className="flex -space-x-1.5">
                {task.assignees.length > 0
                  ? task.assignees.map((a) => <Avatar key={a} name={byId(a)?.name ?? a} size={28} />)
                  : <span className="text-faint">Unassigned</span>}
              </dd>
            </div>
          </dl>

          {/* subtasks checklist */}
          <div className="mt-5 rounded-xl border border-line bg-white/70 p-4">
            <p className="mb-2 flex items-center gap-2 text-[13px] font-bold">
              <ListChecks size={14} className="text-primary" /> Subtasks
              {subtasks.length > 0 && (
                <span className="text-xs font-medium text-muted">
                  {subtasks.filter((s) => s.done).length}/{subtasks.length} done
                </span>
              )}
            </p>
            {subtasks.length > 0 && (
              <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full bg-good transition-all"
                  style={{ width: `${(subtasks.filter((s) => s.done).length / subtasks.length) * 100}%` }}
                />
              </div>
            )}
            <ul className="space-y-1.5">
              {subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={s.done}
                    onChange={() => setSubtasks((ss) => ss.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                  />
                  <span className={clsx("flex-1", s.done && "text-faint line-through")}>{s.text}</span>
                  <button className="btn-ghost px-1 py-0.5 text-bad" aria-label="Delete subtask" onClick={() => setSubtasks((ss) => ss.filter((x) => x.id !== s.id))}>
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input
                className="input py-1.5 text-sm"
                placeholder="Add a subtask and press Enter…"
                value={subDraft}
                onChange={(e) => setSubDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && subDraft.trim()) {
                    setSubtasks((ss) => [...ss, { id: `s-${Date.now()}`, text: subDraft.trim(), done: false }]);
                    setSubDraft("");
                  }
                }}
              />
            </div>
          </div>

          {/* dependency */}
          <div className="mt-4 rounded-xl border border-line bg-white/70 p-4">
            <p className="mb-2 flex items-center gap-2 text-[13px] font-bold">
              <GitBranch size={14} className="text-primary" /> Dependency
            </p>
            <select
              className="input text-sm"
              value={blockedBy}
              onChange={(e) => {
                setBlockedBy(e.target.value);
                onChange({ blockedBy: e.target.value } as never);
              }}
            >
              <option value="">Not blocked by anything</option>
              {siblings.map((t) => (
                <option key={t.id} value={t.id}>Blocked by {t.code} · {t.title.slice(0, 34)}</option>
              ))}
            </select>
            {blockedBy && (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-warn-soft px-2.5 py-1.5 text-xs font-medium text-[#a9720e]">
                <GitBranch size={11} /> Can't start until {siblings.find((t) => t.id === blockedBy)?.code} is completed
              </p>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-line bg-page/60 p-4">
            <p className="mb-1 text-[13px] font-bold">Project Description</p>
            <p className="text-[13px] leading-relaxed text-muted">
              {project ? `Part of ${project.name} — due ${fmtDate(project.deadline)}. ` : ""}
              Track progress, discuss blockers, and attach files here. Status and priority changes save instantly.
            </p>
          </div>

          <div className="mt-6 border-b border-line">
            <span className="-mb-px inline-block border-b-2 border-primary px-1 pb-2 text-sm font-semibold text-primary">Activity</span>
            <span className="ml-5 inline-block pb-2 text-sm text-muted">Comments</span>
          </div>
          <p className="mt-4 text-xs font-bold text-faint uppercase">Today</p>
          <ul className="mt-3 space-y-4">
            {comments.map((c, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <Avatar name={c.by} size={30} />
                <div>
                  <p><span className="font-bold">{c.by}</span> <span className="text-muted">{c.text}</span></p>
                  <p className="mt-0.5 text-xs text-faint">{c.time}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-end gap-2 rounded-xl border border-line bg-white p-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  setComments((cs) => [...cs, { by: CURRENT_USER.name, text: `commented: "${draft.trim()}"`, time: "now" }]);
                  setDraft("");
                }
              }}
              placeholder="Write a comment…"
              className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-faint"
            />
            <button
              className="btn-primary px-2.5 py-1.5"
              aria-label="Send comment"
              onClick={() => {
                if (!draft.trim()) return;
                setComments((cs) => [...cs, { by: CURRENT_USER.name, text: `commented: "${draft.trim()}"`, time: "now" }]);
                setDraft("");
              }}
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */
export default function Tasks() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<"list" | "board" | "calendar">("list");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const open = params.get("new") === "1";
  const { push } = useToast();
  const timer = useTimer();
  const crud = useCrud({
    collection: "tasks",
    seed,
    itemName: "Task",
    makeId: (its) => `qt${its.length + 1}-${Date.now().toString(36)}`,
    fields: [
      { key: "title", label: "Title", required: true, span: true },
      { key: "projectId", label: "Project", type: "select", options: projects.map((p) => ({ value: p.id, label: p.name.slice(0, 40) })) },
      { key: "assignee", label: "Assigned To", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })) },
      { key: "due", label: "Due Date", type: "date", required: true },
      { key: "priority", label: "Priority", type: "select", options: ["High", "Medium", "Low"] },
      { key: "status", label: "Status", type: "select", options: GROUPS.map((g) => ({ value: g.id, label: g.title })) },
      { key: "label", label: "Label", placeholder: "e.g. api, design" },
    ],
    defaults: { due: "2026-09-05", priority: "Medium", status: "Todo", hours: 0, assignees: [] } as never,
  });
  const items = crud.items;
  const rows = items.filter(
    (t) => (status === "All" || t.status === status) && (t.title + t.code).toLowerCase().includes(q.toLowerCase())
  );
  const rowMenu = (t: Task): RowAction[] =>
    crud.rowActions(t, [
      { label: "Open", onClick: () => setOpenTask(t) },
      {
        label: timer.taskId === t.id ? "Timer running…" : "Start timer",
        onClick: () => {
          timer.start(t.id, `${t.code} · ${t.title}`);
          push(`Timer started on ${t.code}`);
        },
      },
      ...(t.status !== "Completed"
        ? [{ label: "Mark Completed", onClick: () => { crud.update(t.id, { status: "Completed" } as never, true); push(`${t.code} completed ✅`); } }]
        : []),
    ]);

  return (
    <>
      <PageHeader
        title="Tasks"
        crumbs={["Work"]}
        actions={
          <>
            <button className="btn-primary" onClick={() => setParams({ new: "1" })}>
              <Plus size={15} /> Add Task
            </button>
            <div className="flex overflow-hidden rounded-[10px] border border-line bg-white/70">
              {([["list", List], ["board", KanbanIcon], ["calendar", CalendarDays]] as const).map(([v, Icon]) => (
                <button
                  key={v}
                  className={clsx("btn px-3 py-2", view === v ? "bg-primary-soft text-primary" : "text-muted hover:text-ink")}
                  onClick={() => setView(v)}
                  aria-label={`${v} view`}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </>
        }
      />
      <FilterBar>
        <DurationFilter />
        <Select label="Status" value={status} onChange={setStatus} options={["All", ...GROUPS.map((g) => g.id)]} />
        <SearchInput value={q} onChange={setQ} />
      </FilterBar>

      {view === "list" && (
        <div className="space-y-5">
          {GROUPS.filter((g) => status === "All" || g.id === status).map((g) => {
            const groupRows = rows.filter((t) => t.status === g.id);
            const isCollapsed = collapsed[g.id];
            return (
              <div key={g.id} className="card overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <button
                    className="btn-ghost -ml-1 px-1 py-1"
                    onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !c[g.id] }))}
                    aria-label="Collapse group"
                  >
                    <ChevronDown size={14} className={clsx("transition-transform", isCollapsed && "-rotate-90")} />
                  </button>
                  <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: g.color }} />
                  <span className="font-display text-[14px] font-bold">{g.title}</span>
                  <span className="text-sm text-faint tabular-nums">{groupRows.length}</span>
                  <button className="btn-ghost ml-auto gap-1 px-2 py-1 text-xs" onClick={() => setParams({ new: "1" })}>
                    <Plus size={13} /> Add Task
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="tbl w-full text-sm">
                      <thead>
                        <tr>
                          <th className="min-w-64">Name task</th>
                          <th>Assignee</th>
                          <th>Due date</th>
                          <th>People</th>
                          <th>Priority</th>
                          <th className="w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupRows.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <button className="cursor-pointer text-left font-medium hover:text-primary" onClick={() => setOpenTask(t)}>
                                {t.title}
                              </button>
                              <span className="ml-2 text-xs text-faint">{t.code}</span>
                            </td>
                            <td>
                              {t.assignees[0] ? (
                                <AvatarName name={byId(t.assignees[0])?.name ?? ""} size={26} />
                              ) : (
                                <span className="text-faint">—</span>
                              )}
                            </td>
                            <td className={clsx("tabular-nums", t.due < todayISO() && t.status !== "Completed" && "font-medium text-bad")}>
                              {fmtDate(t.due)}
                            </td>
                            <td>
                              <span className="flex -space-x-1.5">
                                {t.assignees.map((a) => <Avatar key={a} name={byId(a)?.name ?? a} size={24} />)}
                              </span>
                            </td>
                            <td><StatusPill status={t.priority} /></td>
                            <td className="text-right">
                              <Dropdown
                                button={<button className="btn-ghost rounded-md border border-line px-1.5 py-1.5" aria-label="Row actions"><MoreHorizontal size={13} /></button>}
                                items={rowMenu(t)}
                              />
                            </td>
                          </tr>
                        ))}
                        {groupRows.length === 0 && (
                          <tr><td colSpan={6} className="py-6 text-center text-xs text-faint">No tasks — drag one here or add a task</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "board" && (
        <Kanban
          columns={GROUPS}
          items={rows}
          columnOf={(t) => t.status}
          onMove={(tid, col) => {
            crud.update(tid, { status: col } as never, true);
            push("Task status updated");
          }}
          renderCard={(t) => (
            <button className="w-full cursor-pointer text-left" onClick={() => setOpenTask(t)}>
              <p className="text-xs text-faint">{t.code}</p>
              <p className="mt-0.5 text-sm font-semibold">{t.title}</p>
              <div className="mt-2.5 flex items-center justify-between">
                <StatusPill status={t.priority} />
                <span className="flex -space-x-1.5">{t.assignees.map((a) => <Avatar key={a} name={byId(a)?.name ?? a} size={22} />)}</span>
              </div>
            </button>
          )}
        />
      )}

      {view === "calendar" && (
        <CalendarMonth
          events={items.map((t) => ({
            date: t.due,
            title: `${t.code} · ${t.title}`,
            color: t.status === "Completed" ? "#16a066" : t.priority === "High" ? "#e5554a" : "#5b5ceb",
          }))}
        />
      )}

      {openTask && (
        <TaskDrawer
          task={items.find((t) => t.id === openTask.id) ?? openTask}
          siblings={items.filter((t) => t.id !== openTask.id && t.projectId === openTask.projectId)}
          onClose={() => setOpenTask(null)}
          onChange={(patch) => crud.update(openTask.id, patch as never, true)}
        />
      )}

      <FormModal
        open={open}
        title="Add Task"
        fields={[
          { key: "title", label: "Title", required: true, span: true },
          { key: "projectId", label: "Project", type: "select", options: projects.map((p) => ({ value: p.id, label: p.name.slice(0, 40) })) },
          { key: "assignee", label: "Assigned To", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })) },
          { key: "due", label: "Due Date", type: "date", required: true },
          { key: "priority", label: "Priority", type: "select", options: ["High", "Medium", "Low"] },
          { key: "label", label: "Label", placeholder: "e.g. api, design" },
          { key: "description", label: "Description", type: "textarea" },
        ]}
        initial={{ due: "2026-09-05", priority: "Medium" }}
        submitLabel="Create Task"
        onSubmit={(v) => {
          crud.add({
            ...v,
            code: `QT-${items.length + 1}`,
            assignees: v.assignee ? [v.assignee] : [],
            status: "Todo",
            hours: 0,
          });
          setParams({});
        }}
        onClose={() => setParams({})}
      />
      {crud.modals}
    </>
  );
}
