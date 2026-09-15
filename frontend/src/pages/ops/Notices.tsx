import { Plus } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { can } from "@/lib/api";
import { useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui";
import { notices } from "@/data/ops";
import { fmtDate, todayISO } from "@/lib/format";

export default function Notices() {
  const crud = useCrud({
    collection: "notices",
    seed: notices,
    itemName: "Notice",
    fields: [
      { key: "title", label: "Notice Heading", required: true, span: true },
      { key: "to", label: "Show To", type: "select", options: ["Employees", "Clients", "Everyone"] },
      { key: "date", label: "Date", type: "date" },
      { key: "body", label: "Notice Details", type: "textarea" },
    ],
    defaults: { date: todayISO() } as never,
  });
  return (
    <>
      <PageHeader
        title="Notice Board"
        actions={
          can("notices:create") ? (
            <button className="btn-primary" onClick={crud.openNew}>
              <Plus size={15} /> Add Notice
            </button>
          ) : undefined
        }
      />
      <DataTable
        rows={crud.items}
        columns={[
          { key: "title", label: "Notice", sort: (n) => n.title, render: (n) => <span className="font-medium">{n.title}</span> },
          { key: "to", label: "To", render: (n) => <StatusPill status={n.to} tone="info" /> },
          { key: "date", label: "Date", sort: (n) => n.date, render: (n) => fmtDate(n.date) },
        ]}
        exportName="notices"
        onBulkDelete={crud.removeMany}
        rowActions={(n) => crud.rowActions(n)}
      />
      {crud.modals}
    </>
  );
}
