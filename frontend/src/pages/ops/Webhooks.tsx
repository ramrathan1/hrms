import { Plus } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui";
import { webhooks } from "@/data/ops";

export default function Webhooks() {
  const crud = useCrud({
    collection: "webhooks",
    seed: webhooks as { id: number; name: string; url: string; status: string }[],
    itemName: "Webhook",
    makeId: (its) => its.length + 1,
    fields: [
      { key: "name", label: "Webhook action name", required: true },
      { key: "for", label: "Webhook for", type: "select", options: ["Client", "Lead", "Invoice", "Task"] },
      { key: "url", label: "Request URL", required: true, span: true, placeholder: "https://example.com/hooks/worksuite" },
      { key: "method", label: "Request method", type: "select", options: ["POST", "GET", "PUT"] },
      { key: "format", label: "Request format", type: "select", options: ["JSON", "FORM"] },
      { key: "status", label: "Status", type: "select", options: ["Active", "Disabled"] },
    ],
    defaults: { status: "Active", method: "POST", format: "JSON" } as never,
  });
  return (
    <>
      <PageHeader
        title="Webhooks"
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Add Webhook
          </button>
        }
      />
      <DataTable
        rows={crud.items}
        selectable={false}
        columns={[
          { key: "id", label: "Id", className: "tabular-nums" },
          { key: "name", label: "Webhook action name", render: (w) => <span className="font-medium">{w.name}</span> },
          { key: "url", label: "Request URL", render: (w) => <span className="text-primary">{w.url}</span> },
          { key: "status", label: "Status", render: (w) => <StatusPill status={w.status} /> },
        ]}
        rowActions={(w) => crud.rowActions(w)}
        emptyText="No webhooks yet — add one to get notified about app events"
      />
      {crud.modals}
    </>
  );
}
