import { Copy, Plus } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { leadForms } from "@/data/crm";
import { fmtDate, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function LeadForms() {
  const { push } = useToast();
  const crud = useCrud({
    collection: "leadForms",
    seed: leadForms,
    itemName: "Lead Form",
    fields: [
      { key: "name", label: "Form Name", required: true },
      { key: "created", label: "Created", type: "date" },
      { key: "submissions", label: "Submissions", type: "number" },
    ],
    defaults: { created: todayISO(), submissions: 0 } as never,
  });
  return (
    <>
      <PageHeader
        title="Lead Forms"
        crumbs={["Leads"]}
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Create Form
          </button>
        }
      />
      <div className="card mb-5 px-5 py-4 text-sm text-muted">
        Embed any form on your site — submissions create lead contacts automatically.
      </div>
      <DataTable
        rows={crud.items}
        selectable={false}
        columns={[
          { key: "name", label: "Form Name", sort: (f) => f.name, render: (f) => <span className="font-medium">{f.name}</span> },
          { key: "created", label: "Created", render: (f) => fmtDate(f.created) },
          { key: "submissions", label: "Submissions", sort: (f) => f.submissions, className: "tabular-nums" },
          {
            key: "embed",
            label: "Embed",
            render: (f) => (
              <button
                className="btn-outline px-2.5 py-1 text-xs"
                onClick={() => {
                  navigator.clipboard?.writeText(`<iframe src="https://worksuite.demo/forms/${f.id}" width="100%" height="480"></iframe>`).catch(() => {});
                  push("Embed code copied to clipboard");
                }}
              >
                <Copy size={12} /> Copy code
              </button>
            ),
          },
        ]}
        rowActions={(f) => crud.rowActions(f)}
      />
      {crud.modals}
    </>
  );
}
