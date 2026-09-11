import { ExternalLink, Plus } from "lucide-react";
import { useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui";
import { biolinks } from "@/data/ops";

export default function Biolinks() {
  const crud = useCrud({
    collection: "biolinks",
    seed: biolinks,
    itemName: "Biolink",
    fields: [
      { key: "name", label: "Page Name", required: true },
      { key: "url", label: "URL Slug", required: true, placeholder: "bio.worksuite/your-page" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
    ],
    defaults: { clicks: 0, links: 0, status: "Active" } as never,
  });
  return (
    <>
      <PageHeader
        title="Biolinks"
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Create Biolink
          </button>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {crud.items.map((b) => (
          <div key={b.id} className="card p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{b.name}</p>
              <StatusPill status={b.status} />
            </div>
            <p className="mt-1 flex items-center gap-1 text-sm text-primary">
              {b.url} <ExternalLink size={12} />
            </p>
            <div className="mt-4 flex items-center gap-6 text-sm text-muted">
              <span><b className="text-ink tabular-nums">{b.clicks}</b> clicks</span>
              <span><b className="text-ink tabular-nums">{b.links}</b> links</span>
              <span className="ml-auto flex gap-1.5">
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => crud.openEdit(b)}>Edit</button>
                <button
                  className="btn-ghost px-2 py-1 text-xs"
                  onClick={() => crud.update(b.id, { status: b.status === "Active" ? "Inactive" : "Active" } as never)}
                >
                  {b.status === "Active" ? "Disable" : "Enable"}
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>
      {crud.modals}
    </>
  );
}
