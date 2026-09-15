import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { peopleOptions, selectablePeople } from "@/lib/people";
import { FormModal, useCrud } from "@/components/crud";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { AvatarName, Select, StatusPill } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { projects, tasks, timeLogs } from "@/data/work";
import { useFilters } from "@/lib/filters";
import { hoursLabel, money, todayISO } from "@/lib/format";

export default function Timesheets() {
  const [params, setParams] = useSearchParams();
  const open = params.get("new") === "1";
  const crud = useCrud({
    collection: "timeLogs",
    seed: timeLogs,
    itemName: "Time Log",
    fields: [
      { key: "taskId", label: "Task", type: "select", options: tasks.map((t) => ({ value: t.id, label: `${t.code} · ${t.title.slice(0, 34)}` })), required: true },
      { key: "employee", label: "Employee", type: "select", options: peopleOptions("timelogs:delete"), required: true },
      { key: "start", label: "Start Time", placeholder: `${todayISO()} 09:00 am`, required: true },
      { key: "end", label: "End Time", placeholder: `${todayISO()} 11:00 am`, required: true },
      { key: "hours", label: "Total Hours", type: "number", required: true },
      { key: "memo", label: "Memo", type: "textarea", placeholder: "What did you work on?" },
    ],
    defaults: { start: `${todayISO()} 09:00 am`, end: `${todayISO()} 11:00 am`, hours: 2 } as never,
  });
  const projectOf = (log: (typeof timeLogs)[number]) =>
    projects.find((p) => p.id === tasks.find((t) => t.id === log.taskId)?.projectId)?.name;
  const filters = useFilters<(typeof timeLogs)[number]>([
    // Only people whose time you can actually see — for everyone else this
    // filter listed the whole company beside a list of your own entries.
    { label: "Employee", options: ["All", ...selectablePeople("timelogs:delete").map((e) => e.name)], match: (l, v) => byId(l.employee)?.name === v },
    { label: "Project", options: ["All", ...projects.map((p) => p.name)], match: (l, v) => projectOf(l) === v },
  ]);
  const shown = filters.apply(crud.items);
  return (
    <>
      <PageHeader
        title="Timesheet"
        crumbs={["Work"]}
        actions={
          <button className="btn-primary" onClick={() => setParams({ new: "1" })}>
            <Plus size={15} /> Log Time
          </button>
        }
      />
      <FilterBar>
        <DurationFilter />
        {filters.controls.map((c) => <Select key={c.label} {...c} />)}
        <span className="ml-auto text-xs text-muted">
          {shown.length} of {crud.items.length} logs · {hoursLabel(shown.reduce((a, l) => a + Number(l.hours ?? 0), 0))}
        </span>
      </FilterBar>
      <DataTable
        rows={shown}
        columns={[
          { key: "taskId", label: "Task", render: (t) => (
            <span>
              <span className="block font-medium">{tasks.find((x) => x.id === t.taskId)?.title}</span>
              <span className="text-xs text-faint">{tasks.find((x) => x.id === t.taskId)?.code}</span>
            </span>
          ) },
          { key: "employee", label: "Employee", render: (t) => <AvatarName name={byId(t.employee)?.name ?? "—"} size={28} /> },
          { key: "start", label: "Start Time", sort: (t) => t.start },
          { key: "end", label: "End Time" },
          { key: "hours", label: "Total Hours", sort: (t) => t.hours, render: (t) => <StatusPill status={hoursLabel(t.hours)} tone="info" /> },
          { key: "earn", label: "Earnings", render: (t) => money(t.hours * (byId(t.employee)?.hourly ?? 0)) },
        ]}
        exportName="timesheets"
        onBulkDelete={crud.removeMany}
        rowActions={(t) => crud.rowActions(t)}
      />
      <FormModal
        open={open}
        title="Log Time"
        fields={[
          { key: "taskId", label: "Task", type: "select", options: tasks.map((t) => ({ value: t.id, label: `${t.code} · ${t.title.slice(0, 34)}` })), required: true },
          { key: "employee", label: "Employee", type: "select", options: peopleOptions("timelogs:delete"), required: true },
          { key: "start", label: "Start Time", required: true },
          { key: "end", label: "End Time", required: true },
          { key: "hours", label: "Total Hours", type: "number", required: true },
          { key: "memo", label: "Memo", type: "textarea", placeholder: "What did you work on?" },
        ]}
        initial={{ start: `${todayISO()} 09:00 am`, end: `${todayISO()} 11:00 am`, hours: 2 }}
        submitLabel="Log Time"
        onSubmit={(v) => {
          crud.add(v);
          setParams({});
        }}
        onClose={() => setParams({})}
      />
      {crud.modals}
    </>
  );
}
