import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AttendanceCalendar } from "@/components/AttendanceCalendar";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { Attachments, type FileItem } from "@/components/RecordPanels";
import { Avatar, EmptyState, Progress, StatusPill, Tabs } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { documents, emergencyContacts, leaveQuota, leaves, appreciations } from "@/data/hr";
import { projects, tasks, timeLogs } from "@/data/work";
import { loadAttendanceGrid } from "@/lib/api";
import { fmtDate, hoursLabel, money, todayISO } from "@/lib/format";

const TABS = ["Profile", "Projects", "Tasks", "Attendance", "Leaves", "Leaves Quota", "Timesheet", "Documents", "Emergency Contacts", "Appreciation"];

export default function EmployeeDetail() {
  const { id } = useParams();
  /* Non-null by construction: the route wraps this page in RequireRecord,
     which only renders it once the record is in the store. */
  const emp = byId(id)!;
  const [tab, setTab] = useState("Profile");
  const [docs, setDocs] = useState<FileItem[]>(() =>
    documents
      .filter((d) => d.employee === emp.id)
      .map((d) => ({ id: d.id, name: d.name, size: "—", by: "HR", date: d.date }))
  );
  const contactsCrud = useCrud({
    collection: "emergencyContacts",
    seed: emergencyContacts,
    itemName: "Emergency contact",
    fields: [
      { key: "name", label: "Full name", required: true },
      { key: "relation", label: "Relationship", type: "select", options: ["Spouse", "Parent", "Sibling", "Friend", "Other"] },
      { key: "phone", label: "Phone", required: true },
    ],
    defaults: { employee: emp.id } as never,
  });
  const myProjects = projects.filter((p) => p.members.includes(emp.id));
  const myTasks = tasks.filter((t) => t.assignees.includes(emp.id));
  /* This month's attendance, straight from the server rather than generated. */
  const [presentDays, setPresentDays] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const now = new Date();
    void loadAttendanceGrid(now.getMonth() + 1, now.getFullYear()).then((grid) => {
      if (!live) return;
      setPresentDays(grid?.rows.find((r) => r.employeeId === emp.id)?.present ?? 0);
    });
    return () => {
      live = false;
    };
  }, [emp.id]);
  const thisMonth = new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return (
    <>
      <PageHeader title={emp.name} crumbs={["HR", "Employees"]} />
      <div className="card mb-5 flex flex-wrap items-center gap-5 px-6 py-5">
        <Avatar name={emp.name} size={60} />
        <div>
          <h2 className="text-lg font-bold">{emp.name}</h2>
          <p className="text-sm text-muted">{emp.designation} · {emp.department}</p>
          <p className="mt-0.5 text-xs text-faint">Open tasks: {myTasks.filter((t) => t.status !== "Completed").length} · Projects: {myProjects.length}</p>
        </div>
        <div className="ml-auto grid grid-cols-3 gap-8 text-center text-sm">
          <div><p className="text-lg font-bold text-primary tabular-nums">{presentDays ?? "—"}</p><p className="text-muted">Present · {thisMonth}</p></div>
          <div><p className="text-lg font-bold text-primary tabular-nums">{myTasks.reduce((a, t) => a + t.hours, 0)}h</p><p className="text-muted">Hours logged</p></div>
          <div><p className="text-lg font-bold text-primary tabular-nums">{money(emp.hourly)}/h</p><p className="text-muted">Rate</p></div>
        </div>
      </div>
      <div className="card mb-5 px-2">
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="border-b-0" />
      </div>

      {tab === "Profile" && (
        <div className="card p-6">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm md:grid-cols-2">
            {[
              ["Employee ID", emp.code ?? "—"],
              ["Full Name", emp.name],
              ["Email", emp.email],
              ["Mobile", emp.phone],
              ["Designation", emp.designation],
              ["Department", emp.department],
              ["Joining Date", fmtDate(emp.joined)],
              ["Reporting To", employees.find((x) => x.id === emp.reportsTo)?.name ?? "--"],
              ["Hourly Rate", money(emp.hourly)],
              ["Status", emp.status],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-6 border-b border-line pb-3">
                <dt className="w-36 shrink-0 text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {tab === "Projects" && (
        <DataTable
          rows={myProjects}
          selectable={false}
          columns={[
            { key: "name", label: "Project", render: (p) => <span className="font-medium">{p.name}</span> },
            { key: "deadline", label: "Deadline", render: (p) => fmtDate(p.deadline) },
            { key: "progress", label: "Progress", render: (p) => <Progress value={p.progress} /> },
            { key: "status", label: "Status", render: (p) => <StatusPill status={p.status} /> },
          ]}
          emptyText="Not a member of any project"
        />
      )}

      {tab === "Tasks" && (
        <DataTable
          rows={myTasks}
          selectable={false}
          columns={[
            { key: "code", label: "Code" },
            { key: "title", label: "Task", render: (t) => <span className="font-medium">{t.title}</span> },
            { key: "due", label: "Due Date", render: (t) => <span className={t.due < todayISO() && t.status !== "Completed" ? "text-bad" : ""}>{fmtDate(t.due)}</span> },
            { key: "status", label: "Status", render: (t) => <StatusPill status={t.status} /> },
          ]}
          emptyText="No tasks assigned"
        />
      )}

      {tab === "Attendance" && <AttendanceCalendar employeeId={emp.id} />}

      {tab === "Leaves" && (
        <DataTable
          rows={leaves.filter((l) => l.employee === emp.id)}
          selectable={false}
          columns={[
            { key: "type", label: "Leave Type" },
            { key: "date", label: "Date", render: (l) => fmtDate(l.date) },
            { key: "duration", label: "Duration" },
            { key: "status", label: "Status", render: (l) => <StatusPill status={l.status} /> },
          ]}
          emptyText="No leaves applied"
        />
      )}

      {tab === "Leaves Quota" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {["Casual", "Sick", "Earned"].map((type) => {
            // Quotas are per employee; someone with none set falls back to the
            // standard allowance rather than crashing the tab.
            const quota = leaveQuota.find((qq) => qq.employee === emp.id);
            const yearly = quota ? quota.total / 3 : 10;
            const taken = leaves.filter((l) => l.employee === emp.id && l.type === type && l.status === "Approved").length;
            return (
              <div key={type} className="card px-5 py-4">
                <p className="font-semibold">{type} Leave</p>
                <p className="mt-2 text-2xl font-bold text-primary tabular-nums">{yearly - taken}<span className="text-sm font-medium text-muted"> / {yearly} remaining</span></p>
                <p className="mt-1 text-xs text-muted">Yearly quota {yearly} · Taken {taken}</p>
              </div>
            );
          })}
        </div>
      )}

      {tab === "Timesheet" && (
        <DataTable
          rows={timeLogs.filter((t) => t.employee === emp.id)}
          selectable={false}
          columns={[
            { key: "taskId", label: "Task", render: (t) => tasks.find((x) => x.id === t.taskId)?.title },
            { key: "start", label: "Start Time" },
            { key: "end", label: "End Time" },
            { key: "hours", label: "Total Hours", render: (t) => hoursLabel(t.hours) },
          ]}
          emptyText="No time logged"
        />
      )}

      {tab === "Documents" && (
        <div className="card p-5">
          <p className="mb-3 text-sm text-muted">
            Contracts, ID proofs, certificates and signed policies for {emp.name.split(" ")[0]}.
          </p>
          <Attachments
            files={docs}
            onAdd={(f) => setDocs((fs) => [...fs, f])}
            onRemove={(fid) => setDocs((fs) => fs.filter((x) => x.id !== fid))}
            collection="employeeDocuments"
            recordId={emp.id}
          />
        </div>
      )}

      {tab === "Emergency Contacts" && (
        <>
          <div className="mb-4 flex justify-end">
            <button className="btn-primary" onClick={contactsCrud.openNew}>+ Add emergency contact</button>
          </div>
          <DataTable
            rows={contactsCrud.items.filter((c) => c.employee === emp.id)}
            selectable={false}
            columns={[
              { key: "name", label: "Name", render: (c) => <span className="font-medium">{c.name}</span> },
              { key: "relation", label: "Relationship" },
              { key: "phone", label: "Phone" },
            ]}
            rowActions={(c) => contactsCrud.rowActions(c)}
            emptyText="No emergency contacts — add one so HR can reach someone fast"
          />
          {contactsCrud.modals}
        </>
      )}

      {tab === "Appreciation" && (
        <>
          {appreciations.filter((a) => a.employee === emp.id).length === 0 ? (
            <div className="card"><EmptyState text="No appreciations yet" /></div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {appreciations.filter((a) => a.employee === emp.id).map((a) => (
                <div key={a.id} className="card flex items-center gap-4 px-5 py-4">
                  <span className="text-3xl">{a.photo}</span>
                  <div>
                    <p className="font-semibold">{a.award}</p>
                    <p className="text-xs text-muted">{fmtDate(a.date)} · by {byId(a.givenBy)?.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
