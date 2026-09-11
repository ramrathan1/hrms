/* Global audit trail — every create/update/delete captured at the API layer,
   so nothing can be changed in the app without leaving a record.

   The trail lives on the server and only ever grows, so this pages against it
   rather than holding it: filters and search are query parameters, because
   filtering one page on the client would hide matches sitting on another. */
import clsx from "clsx";
import { History, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { FilterBar, PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { AvatarName, SearchInput, Select, StatusPill } from "@/components/ui";
import { useServerRows } from "@/lib/useServerRows";

const ACTION_TONE: Record<string, string> = {
  create: "good",
  update: "info",
  delete: "bad",
  approve: "good",
  reject: "bad",
  payment: "info",
  login: "muted",
  logout: "muted",
  export: "muted",
};

/** The API's action names, as the filter offers them. */
const ACTIONS = ["All", "CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "PAYMENT", "LOGIN"];

type Entry = {
  id: string;
  action: string;
  entity: string;
  collection: string;
  recordId: string;
  summary: string;
  by: string;
  at: string;
};

const when = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString("en-GB");
};

export default function AuditLog() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("All");
  const [entity, setEntity] = useState("All");

  const filters = useMemo(
    () => ({
      ...(action !== "All" ? { action } : {}),
      ...(entity !== "All" ? { entity } : {}),
      ...(q.trim() ? { q: q.trim() } : {}),
    }),
    [action, entity, q]
  );

  const table = useServerRows<Entry>("audit", { pageSize: 25, filters });

  /* Only what is on screen — the server holds far more than one page, so any
     count here is about this page, and says so. */
  const shown = table.rows;

  return (
    <>
      <PageHeader title="Audit Log" />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recorded events" value={table.total} icon={History} sub="matching these filters" />
        <StatCard label="Created" value={shown.filter((e) => e.action === "create").length} sub="on this page" />
        <StatCard label="Updated" value={shown.filter((e) => e.action === "update").length} sub="on this page" />
        <StatCard label="Deleted" value={shown.filter((e) => e.action === "delete").length} sub="on this page" />
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-good/25 bg-good-soft px-4 py-2.5 text-sm text-good">
        <ShieldCheck size={16} />
        Captured at the API layer — every write is logged automatically, no page can skip it, and
        the trail cannot be cleared from here.
      </div>

      <FilterBar>
        <Select label="Action" value={action} onChange={setAction} options={ACTIONS} />
        <Select
          label="Module"
          value={entity}
          onChange={setEntity}
          options={["All", ...Array.from(new Set(shown.map((e) => e.entity))).filter(Boolean).sort()]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search the trail…" />
      </FilterBar>

      <DataTable
        rows={table.rows}
        server={table.server}
        selectable={false}
        exportName="audit-log"
        columns={[
          { key: "at", label: "When", sort: (e) => e.at, render: (e) => <span className="whitespace-nowrap">{when(e.at)}</span> },
          { key: "by", label: "Who", render: (e) => <AvatarName name={e.by} size={26} /> },
          { key: "action", label: "Action", render: (e) => <StatusPill status={e.action} tone={ACTION_TONE[e.action] ?? "muted"} /> },
          { key: "entity", label: "Module", render: (e) => <span className="font-medium">{e.entity || "—"}</span> },
          { key: "recordId", label: "Record", render: (e) => <span className="font-mono text-xs text-muted">{e.recordId || "—"}</span> },
          { key: "summary", label: "Change", render: (e) => <span className={clsx("text-muted", e.action === "delete" && "text-bad")}>{e.summary}</span> },
        ]}
        emptyText="No activity recorded yet — create or edit something and it will appear here"
      />

    </>
  );
}
