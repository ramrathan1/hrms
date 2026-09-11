/* Role portals — the landing screen each role gets instead of the generic
   dashboard. Every figure here is derived from the same collections the rest of
   the app reads, so a portal is never a mock-up of its own module. */
import clsx from "clsx";
import { useEffect, useState } from "react";
import {
  ArrowRight, BadgeCheck, Banknote, CalendarClock, CheckSquare, ClipboardList, Clock,
  FileWarning, FolderKanban, Inbox, Plane, Receipt, TicketCheck, TrendingUp, UserPlus, Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, AvatarName, EmptyState, Progress, StatusPill } from "@/components/ui";
import { byId, clients, employees } from "@/data/core";
import { expenses, invoices, payments } from "@/data/finance";
import { leaves } from "@/data/hr";
import { applications, interviews, jobs } from "@/data/recruit";
import { tickets } from "@/data/ops";
import { milestones, projects, tasks, timeLogs } from "@/data/work";
import { mailMessages } from "@/data/mail";
import { fmtDate, money, todayISO } from "@/lib/format";
import { CURRENT_USER } from "@/lib/store";
import { roleById } from "@/lib/roles";
import { loadAttendanceGrid } from "@/lib/api";

const TODAY = todayISO();
const overdue = (t: { due?: string; status?: string }) =>
  Boolean(t.due) && t.due! < TODAY && t.status !== "Completed";

/* ------------------------------------------------------------- building blocks */

function Tile({
  label, value, sub, icon: Icon, to, tone = "primary",
}: {
  label: string; value: string | number; sub?: string; icon: LucideIcon; to?: string; tone?: string;
}) {
  const body = (
    <>
      <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        tone === "bad" ? "bg-bad-soft text-bad" : tone === "good" ? "bg-good-soft text-good"
        : tone === "warn" ? "bg-warn-soft text-[#a9720e]" : "bg-primary-soft text-primary")}>
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-2xl font-bold tabular-nums">{value}</span>
        <span className="block truncate text-sm font-medium">{label}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
    </>
  );
  const cls = "card flex items-center gap-3.5 px-5 py-4";
  return to ? (
    <Link to={to} className={clsx(cls, "transition-colors hover:border-primary")}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Panel({
  title, to, linkLabel = "View all", children,
}: {
  title: string; to?: string; linkLabel?: string; children: React.ReactNode;
}) {
  return (
    <section className="card flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="font-display text-[15px] font-bold">{title}</h2>
        {to && (
          <Link to={to} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
            {linkLabel} <ArrowRight size={12} />
          </Link>
        )}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function Rows({ items, empty }: { items: { key: string; left: React.ReactNode; right?: React.ReactNode; to?: string }[]; empty: string }) {
  if (!items.length) return <EmptyState text={empty} />;
  return (
    <ul className="divide-y divide-line">
      {items.map((r) => {
        const inner = (
          <>
            <span className="min-w-0 flex-1">{r.left}</span>
            {r.right && <span className="shrink-0 text-right">{r.right}</span>}
          </>
        );
        return (
          <li key={r.key}>
            {r.to ? (
              <Link to={r.to} className="flex items-center gap-3 px-5 py-3 hover:bg-page/60">{inner}</Link>
            ) : (
              <div className="flex items-center gap-3 px-5 py-3">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
);
const Two = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">{children}</div>
);

function Header({ role, name }: { role: string; name: string }) {
  const def = roleById(role);
  return (
    <PageHeader
      title={`${def.label} portal`}
      crumbs={["Portals"]}
      actions={<span className="hidden text-sm text-muted sm:block">Signed in as {name}</span>}
    />
  );
}

/* ----------------------------------------------------------------- Employee */

/** Enough of an employee record to render a portal for someone without one. */
const selfPlaceholder = () => ({
  id: CURRENT_USER.id,
  name: CURRENT_USER.name,
  email: CURRENT_USER.email,
  designation: CURRENT_USER.role,
  department: "",
  phone: "",
  status: "Active" as const,
  joined: "",
  hourly: 0,
});

export function EmployeePortal() {
  /* The signed-in person's own HR record. Falling back to the first employee
     would show someone else's work as yours, so stand in a minimal record
     built from the session instead. */
  const me = byId(CURRENT_USER.id) ?? selfPlaceholder();
  const myTasks = tasks.filter((t) => t.assignees.includes(me.id));
  const open = myTasks.filter((t) => t.status !== "Completed");
  const late = myTasks.filter(overdue);
  const myLeave = leaves.filter((l) => l.employee === me.id);
  const myHours = timeLogs.filter((l) => l.employee === me.id).reduce((a, l) => a + l.hours, 0);
  // Days present this month, from the server's grid rather than generated.
  const [present, setPresent] = useState(0);
  useEffect(() => {
    const now = new Date();
    let live = true;
    void loadAttendanceGrid(now.getMonth() + 1, now.getFullYear()).then((grid) => {
      if (live) setPresent(grid?.rows.find((r) => r.employeeId === me.id)?.present ?? 0);
    });
    return () => {
      live = false;
    };
  }, [me.id]);
  const myProjects = projects.filter((p) => p.members.includes(me.id));
  const unread = mailMessages.filter((m) => !m.read && m.folderId === "inbox").length;

  return (
    <>
      <Header role="employee" name={me.name} />
      <Grid>
        <Tile label="Open tasks" value={open.length} sub={`${myTasks.length} assigned in total`} icon={CheckSquare} to="/work/tasks" />
        <Tile label="Overdue" value={late.length} sub={late.length ? "needs attention today" : "nothing late"} icon={FileWarning} tone={late.length ? "bad" : "good"} to="/work/tasks" />
        <Tile label="Hours logged" value={`${Math.round(myHours)}h`} sub="on your timesheet" icon={Clock} to="/work/timesheets" />
        <Tile label="Unread mail" value={unread} sub="in your inbox" icon={Inbox} to="/mail" />
      </Grid>

      <Two>
        <Panel title="My tasks" to="/work/tasks">
          <Rows
            empty="Nothing assigned to you right now"
            items={open.slice(0, 6).map((t) => ({
              key: t.id,
              to: "/work/tasks",
              left: (
                <>
                  <span className="block truncate text-sm font-medium">{t.title}</span>
                  <span className="text-xs text-muted">{projects.find((p) => p.id === t.projectId)?.name ?? "—"} · {t.code}</span>
                </>
              ),
              right: <span className={clsx("text-xs tabular-nums", overdue(t) ? "font-semibold text-bad" : "text-muted")}>{fmtDate(t.due)}</span>,
            }))}
          />
        </Panel>

        <Panel title="My attendance & leave" to="/hr/leaves" linkLabel="Request leave">
          <div className="grid grid-cols-2 gap-4 border-b border-line px-5 py-4 text-center">
            <div>
              <p className="font-display text-2xl font-bold text-primary tabular-nums">{present}</p>
              <p className="text-xs text-muted">days present · {new Date().toLocaleDateString(undefined, { month: "short" })}</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-primary tabular-nums">{myLeave.filter((l) => l.status === "Approved").length}</p>
              <p className="text-xs text-muted">leave days approved</p>
            </div>
          </div>
          <Rows
            empty="No leave requests yet"
            items={myLeave.slice(0, 4).map((l) => ({
              key: l.id,
              left: <span className="text-sm font-medium">{l.type}</span>,
              right: <StatusPill status={l.status} />,
            }))}
          />
        </Panel>

        <Panel title="My projects" to="/work/projects">
          <Rows
            empty="You're not on a project yet"
            items={myProjects.slice(0, 5).map((p) => ({
              key: p.id,
              to: `/work/projects/${p.id}`,
              left: (
                <>
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="mt-1 block max-w-40"><Progress value={p.progress} /></span>
                </>
              ),
              right: <StatusPill status={p.status} />,
            }))}
          />
        </Panel>

        <Panel title="Quick actions">
          <div className="grid grid-cols-2 gap-3 p-5">
            {[
              ["Log time", "/work/timesheets", Clock],
              ["Request leave", "/hr/leaves", Plane],
              ["Raise a ticket", "/tickets", TicketCheck],
              ["Read the handbook", "/knowledge", ClipboardList],
            ].map(([label, to, Icon]) => (
              <Link key={label as string} to={to as string} className="flex items-center gap-2.5 rounded-xl border border-line bg-white/70 px-3.5 py-3 text-sm font-medium hover:border-primary hover:text-primary">
                {(() => { const I = Icon as LucideIcon; return <I size={16} className="shrink-0" />; })()}
                <span className="truncate">{label as string}</span>
              </Link>
            ))}
          </div>
        </Panel>
      </Two>
    </>
  );
}

/* ---------------------------------------------------------------- Team Lead */

export function TeamLeaderPortal() {
  /* The signed-in person's own HR record. Falling back to the first employee
     would show someone else's work as yours, so stand in a minimal record
     built from the session instead. */
  const me = byId(CURRENT_USER.id) ?? selfPlaceholder();
  const team = employees.filter((e) => e.reportsTo === me.id);
  const teamIds = new Set([me.id, ...team.map((t) => t.id)]);
  const teamTasks = tasks.filter((t) => t.assignees.some((a) => teamIds.has(a)));
  const late = teamTasks.filter(overdue);
  const pendingLeave = leaves.filter((l) => l.status === "Pending" && teamIds.has(l.employee));
  const teamProjects = projects.filter((p) => p.members.some((m) => teamIds.has(m)));

  return (
    <>
      <Header role="team-leader" name={me.name} />
      <Grid>
        <Tile label="In my team" value={team.length} sub="direct reports" icon={Users} to="/hr/employees" />
        <Tile label="Open tasks" value={teamTasks.filter((t) => t.status !== "Completed").length} sub={`across ${teamProjects.length} projects`} icon={CheckSquare} to="/work/tasks" />
        <Tile label="Overdue" value={late.length} tone={late.length ? "bad" : "good"} sub={late.length ? "past their due date" : "team is on time"} icon={FileWarning} to="/work/tasks" />
        <Tile label="Leave to approve" value={pendingLeave.length} tone={pendingLeave.length ? "warn" : "good"} sub="waiting on you" icon={Plane} to="/approvals" />
      </Grid>

      <Two>
        <Panel title="Team workload" to="/work/workload">
          <Rows
            empty="No direct reports yet"
            items={team.map((m) => {
              const mine = tasks.filter((t) => t.assignees.includes(m.id) && t.status !== "Completed");
              const mineLate = mine.filter(overdue).length;
              return {
                key: m.id,
                to: `/hr/employees/${m.id}`,
                left: <AvatarName name={m.name} sub={m.designation} size={30} />,
                right: (
                  <span className="text-xs">
                    <span className="font-semibold tabular-nums">{mine.length}</span> open
                    {mineLate > 0 && <span className="ml-1.5 font-semibold text-bad tabular-nums">{mineLate} late</span>}
                  </span>
                ),
              };
            })}
          />
        </Panel>

        <Panel title="Waiting on me" to="/approvals" linkLabel="Open approvals">
          <Rows
            empty="Nothing waiting for your approval"
            items={pendingLeave.slice(0, 6).map((l) => ({
              key: l.id,
              to: "/approvals",
              left: (
                <>
                  <span className="block text-sm font-medium">{byId(l.employee)?.name ?? l.employee}</span>
                  <span className="text-xs text-muted">{l.type} · {fmtDate(l.date)}</span>
                </>
              ),
              right: <StatusPill status={l.status} />,
            }))}
          />
        </Panel>

        <Panel title="Overdue tasks" to="/work/tasks">
          <Rows
            empty="Nothing overdue — nice"
            items={late.slice(0, 6).map((t) => ({
              key: t.id,
              to: "/work/tasks",
              left: (
                <>
                  <span className="block truncate text-sm font-medium">{t.title}</span>
                  <span className="text-xs text-muted">{t.assignees.map((a) => byId(a)?.name.split(" ")[0]).join(", ")}</span>
                </>
              ),
              right: <span className="text-xs font-semibold text-bad tabular-nums">{fmtDate(t.due)}</span>,
            }))}
          />
        </Panel>

        <Panel title="Team projects" to="/work/projects">
          <Rows
            empty="No projects assigned to your team"
            items={teamProjects.slice(0, 6).map((p) => ({
              key: p.id,
              to: `/work/projects/${p.id}`,
              left: (
                <>
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="mt-1 block max-w-40"><Progress value={p.progress} /></span>
                </>
              ),
              right: <span className="text-xs text-muted tabular-nums">{fmtDate(p.deadline)}</span>,
            }))}
          />
        </Panel>
      </Two>
    </>
  );
}

/* --------------------------------------------------------------------- HR */

export function HrPortal() {
  const active = employees.filter((e) => e.status === "Active");
  const pendingLeave = leaves.filter((l) => l.status === "Pending");
  const onLeaveToday = leaves.filter((l) => l.status === "Approved" && (l.date) === TODAY);
  const openJobs = jobs.filter((j) => j.status === "Open");
  const newApplications = applications.filter((a) => a.status === "Applied");
  const upcomingInterviews = interviews.filter((i) => (i.date ?? "") >= TODAY);
  const joinedThisYear = active.filter((e) => e.joined >= "2026-01-01");

  return (
    <>
      <Header role="hr" name={CURRENT_USER.name} />
      <Grid>
        <Tile label="Active employees" value={active.length} sub={`${joinedThisYear.length} joined this year`} icon={Users} to="/hr/employees" />
        <Tile label="Leave to approve" value={pendingLeave.length} tone={pendingLeave.length ? "warn" : "good"} sub="pending requests" icon={Plane} to="/approvals" />
        <Tile label="Open roles" value={openJobs.length} sub={`${newApplications.length} new applications`} icon={UserPlus} to="/recruit/jobs" />
        <Tile label="Out today" value={onLeaveToday.length} sub="approved absences" icon={CalendarClock} to="/hr/attendance" />
      </Grid>

      <Two>
        <Panel title="Leave requests" to="/approvals" linkLabel="Review">
          <Rows
            empty="No leave waiting for a decision"
            items={pendingLeave.slice(0, 6).map((l) => ({
              key: l.id,
              to: "/approvals",
              left: (
                <>
                  <span className="block text-sm font-medium">{byId(l.employee)?.name ?? l.employee}</span>
                  <span className="text-xs text-muted">{l.type} · {l.duration}</span>
                </>
              ),
              right: <span className="text-xs text-muted tabular-nums">{fmtDate(l.date)}</span>,
            }))}
          />
        </Panel>

        <Panel title="Hiring pipeline" to="/recruit">
          <Rows
            empty="No open roles"
            items={openJobs.slice(0, 6).map((j) => ({
              key: j.id,
              to: "/recruit/jobs",
              left: (
                <>
                  <span className="block truncate text-sm font-medium">{j.title}</span>
                  <span className="text-xs text-muted">{j.type} · {j.openings ?? 1} opening{(j.openings ?? 1) === 1 ? "" : "s"}</span>
                </>
              ),
              right: (
                <span className="text-xs tabular-nums text-muted">
                  {applications.filter((a) => a.jobId === j.id).length} applicants
                </span>
              ),
            }))}
          />
        </Panel>

        <Panel title="Upcoming interviews" to="/recruit/interviews">
          <Rows
            empty="Nothing scheduled"
            items={upcomingInterviews.slice(0, 6).map((i) => ({
              key: i.id,
              to: "/recruit/interviews",
              left: (
                <>
                  <span className="block truncate text-sm font-medium">{i.candidate}</span>
                  <span className="text-xs text-muted">{i.job} · {i.time}</span>
                </>
              ),
              right: <span className="text-xs text-muted tabular-nums">{fmtDate(i.date)}</span>,
            }))}
          />
        </Panel>

        <Panel title="Newest joiners" to="/hr/employees">
          <Rows
            empty="No one has joined recently"
            items={[...active].sort((a, b) => b.joined.localeCompare(a.joined)).slice(0, 6).map((e) => ({
              key: e.id,
              to: `/hr/employees/${e.id}`,
              left: <AvatarName name={e.name} sub={e.designation} size={30} />,
              right: <span className="text-xs text-muted tabular-nums">{fmtDate(e.joined)}</span>,
            }))}
          />
        </Panel>
      </Two>
    </>
  );
}

/* -------------------------------------------------------------- Accountant */

export function AccountantPortal() {
  const billed = invoices.reduce((a, i) => a + (i.total ?? 0), 0);
  const collected = invoices.reduce((a, i) => a + (i.paid ?? 0), 0);
  const outstanding = billed - collected;
  const overdueInvoices = invoices.filter((i) => (i.total ?? 0) - (i.paid ?? 0) > 0 && (i.due ?? "") < TODAY);
  const pendingExpenses = expenses.filter((e) => e.status === "Pending");
  const spend = expenses.filter((e) => e.status !== "Rejected").reduce((a, e) => a + (e.price), 0);

  return (
    <>
      <Header role="accountant" name={CURRENT_USER.name} />
      <Grid>
        <Tile label="Outstanding" value={money(outstanding)} sub={`${money(billed)} billed in total`} icon={Receipt} tone={outstanding > 0 ? "warn" : "good"} to="/finance/invoices" />
        <Tile label="Collected" value={money(collected)} sub={billed ? `${Math.round((collected / billed) * 100)}% collection rate` : "nothing billed"} icon={Banknote} tone="good" to="/finance/payments" />
        <Tile label="Overdue invoices" value={overdueInvoices.length} tone={overdueInvoices.length ? "bad" : "good"} sub="past their due date" icon={FileWarning} to="/finance/invoices" />
        <Tile label="Expenses to approve" value={pendingExpenses.length} tone={pendingExpenses.length ? "warn" : "good"} sub={`${money(spend)} approved spend`} icon={ClipboardList} to="/approvals" />
      </Grid>

      <Two>
        <Panel title="Overdue invoices" to="/finance/invoices" linkLabel="Chase">
          <Rows
            empty="Nothing overdue — everything is current"
            items={overdueInvoices.slice(0, 6).map((i) => ({
              key: i.id,
              to: `/finance/invoices/${i.id}`,
              left: (
                <>
                  <span className="block text-sm font-medium">{i.number}</span>
                  <span className="text-xs text-muted">{clients.find((c) => c.id === i.clientId)?.company ?? "—"}</span>
                </>
              ),
              right: (
                <>
                  <span className="block text-sm font-semibold tabular-nums">{money((i.total ?? 0) - (i.paid ?? 0))}</span>
                  <span className="text-xs font-medium text-bad tabular-nums">due {fmtDate(i.due)}</span>
                </>
              ),
            }))}
          />
        </Panel>

        <Panel title="Expenses awaiting approval" to="/approvals">
          <Rows
            empty="No expense claims waiting"
            items={pendingExpenses.slice(0, 6).map((e) => ({
              key: e.id,
              to: "/approvals",
              left: (
                <>
                  <span className="block truncate text-sm font-medium">{e.item}</span>
                  <span className="text-xs text-muted">{e.category} · {byId(e.employee)?.name ?? "—"}</span>
                </>
              ),
              right: <span className="text-sm font-semibold tabular-nums">{money(e.price)}</span>,
            }))}
          />
        </Panel>

        <Panel title="Recent payments" to="/finance/payments">
          <Rows
            empty="No payments recorded yet"
            items={[...payments].slice(-6).reverse().map((p) => ({
              key: p.id,
              to: "/finance/payments",
              left: (
                <>
                  <span className="block text-sm font-medium">{invoices.find((i) => i.id === p.invoiceId)?.number ?? p.invoiceId}</span>
                  <span className="text-xs text-muted">{p.gateway} · {fmtDate(p.date)}</span>
                </>
              ),
              right: <span className="text-sm font-semibold text-good tabular-nums">{money(p.amount ?? 0)}</span>,
            }))}
          />
        </Panel>

        <Panel title="Top clients by billing" to="/clients">
          <Rows
            empty="No billing yet"
            items={clients
              .map((c) => ({ c, total: invoices.filter((i) => i.clientId === c.id).reduce((a, i) => a + (i.total ?? 0), 0) }))
              .filter((x) => x.total > 0)
              .sort((a, b) => b.total - a.total)
              .slice(0, 6)
              .map(({ c, total }) => ({
                key: c.id,
                to: `/clients/${c.id}`,
                left: <AvatarName name={c.name} sub={c.company} size={30} />,
                right: <span className="text-sm font-semibold tabular-nums">{money(total)}</span>,
              }))}
          />
        </Panel>
      </Two>
    </>
  );
}

/* ----------------------------------------------------------------- Manager */

export function ManagerPortal() {
  const activeProjects = projects.filter((p) => p.status === "In Progress");
  const atRisk = projects.filter((p) => p.deadline < TODAY && p.progress < 100);
  const openTickets = tickets.filter((t) => t.status === "Open" || t.status === "Pending");
  const late = tasks.filter(overdue);
  const dueMilestones = milestones.filter((m) => m.status !== "Complete");

  return (
    <>
      <Header role="manager" name={CURRENT_USER.name} />
      <Grid>
        <Tile label="Active projects" value={activeProjects.length} sub={`${projects.length} in the portfolio`} icon={FolderKanban} to="/work/projects" />
        <Tile label="Projects at risk" value={atRisk.length} tone={atRisk.length ? "bad" : "good"} sub="past deadline, unfinished" icon={FileWarning} to="/work/projects" />
        <Tile label="Overdue tasks" value={late.length} tone={late.length ? "warn" : "good"} sub="across every team" icon={CheckSquare} to="/work/tasks" />
        <Tile label="Open tickets" value={openTickets.length} sub="waiting on support" icon={TicketCheck} to="/tickets" />
      </Grid>

      <Two>
        <Panel title="Project health" to="/work/projects">
          <Rows
            empty="No projects yet"
            items={projects.slice(0, 7).map((p) => {
              const risk = p.deadline < TODAY && p.progress < 100;
              return {
                key: p.id,
                to: `/work/projects/${p.id}`,
                left: (
                  <>
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="mt-1 block max-w-44"><Progress value={p.progress} /></span>
                  </>
                ),
                right: risk
                  ? <span className="text-xs font-semibold text-bad">at risk</span>
                  : <span className="text-xs text-muted tabular-nums">{fmtDate(p.deadline)}</span>,
              };
            })}
          />
        </Panel>

        <Panel title="Milestones coming up" to="/work/projects">
          <Rows
            empty="No milestones outstanding"
            items={[...dueMilestones].sort((a, b) => String(a.due).localeCompare(String(b.due))).slice(0, 6).map((m) => ({
              key: m.id,
              to: `/work/projects/${m.projectId}`,
              left: (
                <>
                  <span className="block truncate text-sm font-medium">{m.title}</span>
                  <span className="text-xs text-muted">{projects.find((p) => p.id === m.projectId)?.name ?? "—"}</span>
                </>
              ),
              right: (
                <>
                  <span className="block text-xs text-muted tabular-nums">{fmtDate(m.due)}</span>
                  <StatusPill status={m.status} />
                </>
              ),
            }))}
          />
        </Panel>

        <Panel title="Who's loaded" to="/work/workload">
          <Rows
            empty="No one is assigned work"
            items={employees
              .map((e) => ({ e, n: tasks.filter((t) => t.assignees.includes(e.id) && t.status !== "Completed").length }))
              .filter((x) => x.n > 0)
              .sort((a, b) => b.n - a.n)
              .slice(0, 6)
              .map(({ e, n }) => ({
                key: e.id,
                to: `/hr/employees/${e.id}`,
                left: <AvatarName name={e.name} sub={e.designation} size={30} />,
                right: <span className="text-xs"><span className="font-semibold tabular-nums">{n}</span> open</span>,
              }))}
          />
        </Panel>

        <Panel title="Open tickets" to="/tickets">
          <Rows
            empty="No open tickets"
            items={openTickets.slice(0, 6).map((t) => ({
              key: t.id,
              to: `/tickets/${t.id}`,
              left: (
                <>
                  <span className="block truncate text-sm font-medium">{t.subject}</span>
                  <span className="text-xs text-muted">{t.requester}</span>
                </>
              ),
              right: <StatusPill status={t.priority} />,
            }))}
          />
        </Panel>
      </Two>
    </>
  );
}

/* ------------------------------------------------------------------- Owner */

export function OwnerPortal() {
  const billed = invoices.reduce((a, i) => a + (i.total ?? 0), 0);
  const collected = invoices.reduce((a, i) => a + (i.paid ?? 0), 0);
  const spend = expenses.filter((e) => e.status !== "Rejected").reduce((a, e) => a + (e.price), 0);
  const active = employees.filter((e) => e.status === "Active");
  const pending = leaves.filter((l) => l.status === "Pending").length + expenses.filter((e) => e.status === "Pending").length;
  const atRisk = projects.filter((p) => p.deadline < TODAY && p.progress < 100);

  return (
    <>
      <Header role="owner" name={CURRENT_USER.name} />
      <Grid>
        <Tile label="Collected" value={money(collected)} sub={`${money(billed - collected)} still outstanding`} icon={Banknote} tone="good" to="/finance/invoices" />
        <Tile label="Margin" value={money(collected - spend)} sub={`${money(spend)} in costs`} icon={TrendingUp} tone={collected - spend >= 0 ? "good" : "bad"} to="/reports" />
        <Tile label="Headcount" value={active.length} sub={`${clients.length} clients`} icon={Users} to="/hr/employees" />
        <Tile label="Waiting on approval" value={pending} tone={pending ? "warn" : "good"} sub="leave and expenses" icon={Inbox} to="/approvals" />
      </Grid>

      <Two>
        <Panel title="Where the money is" to="/finance/invoices">
          <div className="space-y-3.5 p-5">
            {[
              { label: "Billed", value: billed, of: billed, tone: "bg-primary" },
              { label: "Collected", value: collected, of: billed, tone: "bg-good" },
              { label: "Costs", value: spend, of: billed, tone: "bg-bad" },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-muted">{row.label}</span>
                  <span className="font-semibold tabular-nums">{money(row.value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div className={clsx("h-full rounded-full", row.tone)} style={{ width: `${row.of ? Math.min(100, (row.value / row.of) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
            <p className="border-t border-line pt-3 text-xs text-muted">
              Collection rate {billed ? Math.round((collected / billed) * 100) : 0}% · margin{" "}
              {collected ? Math.round(((collected - spend) / collected) * 100) : 0}% of collected revenue.
            </p>
          </div>
        </Panel>

        <Panel title="Projects at risk" to="/work/projects">
          <Rows
            empty="Every project is on schedule"
            items={atRisk.slice(0, 6).map((p) => ({
              key: p.id,
              to: `/work/projects/${p.id}`,
              left: (
                <>
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-muted">{clients.find((c) => c.id === p.clientId)?.company ?? "—"}</span>
                </>
              ),
              right: (
                <>
                  <span className="block text-xs font-semibold text-bad tabular-nums">{fmtDate(p.deadline)}</span>
                  <span className="text-xs text-muted tabular-nums">{p.progress}% done</span>
                </>
              ),
            }))}
          />
        </Panel>

        <Panel title="Biggest clients" to="/clients">
          <Rows
            empty="No clients yet"
            items={clients
              .map((c) => ({ c, total: invoices.filter((i) => i.clientId === c.id).reduce((a, i) => a + (i.total ?? 0), 0) }))
              .sort((a, b) => b.total - a.total)
              .slice(0, 6)
              .map(({ c, total }) => ({
                key: c.id,
                to: `/clients/${c.id}`,
                left: <AvatarName name={c.name} sub={c.company} size={30} />,
                right: <span className="text-sm font-semibold tabular-nums">{money(total)}</span>,
              }))}
          />
        </Panel>

        <Panel title="Company at a glance" to="/reports">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 p-5 text-sm">
            {[
              ["Projects", `${projects.length} (${projects.filter((p) => p.status === "In Progress").length} active)`],
              ["Open tasks", String(tasks.filter((t) => t.status !== "Completed").length)],
              ["Open tickets", String(tickets.filter((t) => t.status === "Open").length)],
              ["Hours logged", `${Math.round(timeLogs.reduce((a, l) => a + l.hours, 0))}h`],
              ["Open roles", String(jobs.filter((j) => j.status === "Open").length)],
              ["Invoices raised", String(invoices.length)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </Two>
    </>
  );
}

/* ------------------------------------------------------- Client (internal) */

export function ClientPortalHome() {
  /* Which client is this? Match on the signed-in email, else show a picker so
     the portal is reachable in a demo without a real client login. */
  const mine = clients.find((c) => c.email === CURRENT_USER.email);

  if (!mine) {
    return (
      <>
        <Header role="client" name={CURRENT_USER.name} />
        <div className="card p-6">
          <p className="mb-1 font-semibold">Pick a client to preview</p>
          <p className="mb-5 text-sm text-muted">
            A real client signs in with their own address. Nothing here matches{" "}
            <span className="font-medium">{CURRENT_USER.email}</span>, so choose whose portal to open.
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {clients.map((c) => (
              <li key={c.id}>
                <Link to={`/portal/${c.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-white/70 px-4 py-3 hover:border-primary">
                  <Avatar name={c.name} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.company}</span>
                    <span className="block truncate text-xs text-muted">{c.name}</span>
                  </span>
                  <ArrowRight size={14} className="ml-auto shrink-0 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  }

  const myProjects = projects.filter((p) => p.clientId === mine.id);
  const myInvoices = invoices.filter((i) => i.clientId === mine.id);
  const due = myInvoices.reduce((a, i) => a + ((i.total ?? 0) - (i.paid ?? 0)), 0);
  const myTickets = tickets.filter((t) => t.requester === mine.name);

  return (
    <>
      <Header role="client" name={mine.company} />
      <Grid>
        <Tile label="Active projects" value={myProjects.filter((p) => p.status !== "Completed").length} sub={`${myProjects.length} in total`} icon={FolderKanban} to={`/portal/${mine.id}`} />
        <Tile label="Amount due" value={money(due)} tone={due > 0 ? "warn" : "good"} sub={`${myInvoices.length} invoices`} icon={Receipt} to={`/portal/${mine.id}`} />
        <Tile label="Open tickets" value={myTickets.filter((t) => t.status !== "Closed").length} sub="with our support team" icon={TicketCheck} to="/tickets" />
        <Tile label="Account manager" value={byId(myProjects[0]?.members?.[0])?.name.split(" ")[0] ?? "—"} sub="your main contact" icon={BadgeCheck} />
      </Grid>

      <Two>
        <Panel title="Your projects" to={`/portal/${mine.id}`} linkLabel="Full portal">
          <Rows
            empty="No projects yet"
            items={myProjects.map((p) => ({
              key: p.id,
              left: (
                <>
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="mt-1 block max-w-44"><Progress value={p.progress} /></span>
                </>
              ),
              right: <StatusPill status={p.status} />,
            }))}
          />
        </Panel>

        <Panel title="Your invoices" to={`/portal/${mine.id}`}>
          <Rows
            empty="Nothing invoiced yet"
            items={myInvoices.map((i) => ({
              key: i.id,
              left: (
                <>
                  <span className="block text-sm font-medium">{i.number}</span>
                  <span className="text-xs text-muted">due {fmtDate(i.due)}</span>
                </>
              ),
              right: (
                <>
                  <span className="block text-sm font-semibold tabular-nums">{money(i.total ?? 0)}</span>
                  <StatusPill status={i.status} />
                </>
              ),
            }))}
          />
        </Panel>
      </Two>
    </>
  );
}
