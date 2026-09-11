import { Plus } from "lucide-react";
import { useState } from "react";
import { FormModal } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { AvatarName, StatusPill, Tabs } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { meetings } from "@/data/people2";
import { api } from "@/lib/api";
import { useToast } from "@/lib/store";

const TABS = ["Upcoming", "Completed", "Cancelled"];

export default function Meetings() {
  const [tab, setTab] = useState("Upcoming");
  const { push } = useToast();
  const [items, setItems] = useState(() => [...meetings]);
  const [open, setOpen] = useState(false);
  const rows = items.filter((m) => m.status === (tab === "Upcoming" ? "Upcoming" : tab === "Completed" ? "Completed" : "Cancelled"));
  const grouped = [...new Set(rows.map((m) => m.month))];
  return (
    <>
      <PageHeader
        title="1-on-1 Meetings"
        crumbs={["Performance"]}
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> Add Meeting
          </button>
        }
      />
      <FormModal
        open={open}
        title="Schedule a 1-on-1"
        fields={[
          { key: "forEmp", label: "Meeting For", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })), required: true },
          { key: "by", label: "Meeting By", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })), required: true },
          { key: "date", label: "Date", type: "date", required: true },
          { key: "time", label: "Time", placeholder: "10:00 am – 10:30 am", required: true },
          { key: "agenda", label: "Agenda", type: "textarea" },
        ]}
        initial={{ date: "2026-09-05", time: "10:00 am – 10:30 am" }}
        submitLabel="Schedule"
        onSubmit={(v) => {
          const m = {
            id: `mt-${Date.now()}`,
            forEmp: String(v.forEmp),
            by: String(v.by),
            date: String(v.date),
            time: String(v.time),
            status: "Upcoming",
            month: new Date(String(v.date) + "T00:00:00").toLocaleDateString("en-US", { month: "long" }),
          };
          setItems((its) => [m, ...its]);
          meetings.push(m);
          void api.create("meetings", m);
          push("1-on-1 scheduled");
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
      <div className="card mb-5 px-2">
        <Tabs
          tabs={TABS.map((t) => `${t} (${items.filter((m) => m.status === (t === "Upcoming" ? "Upcoming" : t)).length})`)}
          active={TABS.map((t) => `${t} (${items.filter((m) => m.status === (t === "Upcoming" ? "Upcoming" : t)).length})`)[TABS.indexOf(tab)]}
          onChange={(t) => setTab(t.split(" (")[0])}
          className="border-b-0"
        />
      </div>
      {grouped.length === 0 && <div className="card p-10 text-center text-sm text-faint">No meetings here</div>}
      {grouped.map((month) => (
        <div key={month} className="mb-6">
          <h3 className="mb-3 font-semibold">{month}</h3>
          <div className="space-y-3">
            {rows.filter((m) => m.month === month).map((m) => (
              <div key={m.id} className="card flex flex-wrap items-center gap-5 px-5 py-4">
                <div className="w-14 rounded-md border border-line py-1.5 text-center">
                  <p className="text-lg font-bold leading-none tabular-nums">{m.date.slice(8)}</p>
                  <p className="text-[10px] text-muted uppercase">{new Date(m.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}</p>
                </div>
                <div className="text-sm">
                  <p className="font-medium">🕐 {m.time}</p>
                  {m.status !== "Upcoming" && <StatusPill status={m.status} />}
                </div>
                <div className="ml-auto flex items-center gap-8 text-sm">
                  <div><p className="mb-1 text-xs text-faint">Meeting For:</p><AvatarName name={byId(m.forEmp)?.name ?? "—"} sub={byId(m.forEmp)?.designation} size={30} /></div>
                  <div><p className="mb-1 text-xs text-faint">Meeting By:</p><AvatarName name={byId(m.by)?.name ?? "—"} sub={byId(m.by)?.designation} size={30} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
