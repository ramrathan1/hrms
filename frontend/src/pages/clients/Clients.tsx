import { Download, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { AvatarName, SearchInput, Select, StatusPill } from "@/components/ui";
import { clients } from "@/data/core";
import { fmtDate } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function Clients() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const nav = useNavigate();
  const { push } = useToast();
  const crud = useCrud({
    collection: "clients",
    seed: clients,
    itemName: "Client",
    onView: (c) => nav(`/clients/${c.id}`),
    fields: [
      { key: "name", label: "Client Name", required: true },
      { key: "company", label: "Company Name", required: true },
      { key: "email", label: "Email", required: true },
      { key: "phone", label: "Phone" },
      { key: "category", label: "Category", type: "select", options: ["Enterprise", "SMB", "Agency"] },
      { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
    ],
  });
  const rows = crud.items.filter(
    (c) =>
      (cat === "All" || c.category === cat) &&
      (c.name + c.company + c.email).toLowerCase().includes(q.toLowerCase())
  );
  return (
    <>
      <PageHeader
        title="Clients"
        actions={
          <>
            <Link to="/clients/new" className="btn-primary">
              <Plus size={15} /> Add Client
            </Link>
            <button className="btn-outline" onClick={() => push("Invite email queued — configure SMTP in Settings → Notifications")}>
              <UserPlus size={15} /> Invite Client
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                const csv = ["Name,Company,Email,Phone,Category,Status", ...rows.map((c) => [c.name, c.company, c.email, c.phone, c.category, c.status].join(","))].join("\n");
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                a.download = "clients.csv";
                a.click();
                push("clients.csv downloaded");
              }}
            >
              <Download size={15} /> Export
            </button>
          </>
        }
      />
      <FilterBar>
        <DurationFilter />
        <Select label="Category" value={cat} onChange={setCat} options={["All", "Enterprise", "SMB", "Agency"]} />
        <SearchInput value={q} onChange={setQ} />
      </FilterBar>
      <DataTable
        rows={rows}
        columns={[
          { key: "name", label: "Name", sort: (c) => c.name, render: (c) => <Link to={`/clients/${c.id}`}><AvatarName name={c.name} sub={c.company} /></Link> },
          { key: "email", label: "Email", sort: (c) => c.email },
          { key: "phone", label: "Phone" },
          { key: "category", label: "Category", sort: (c) => c.category },
          { key: "added", label: "Created", sort: (c) => c.added, render: (c) => fmtDate(c.added) },
          { key: "status", label: "Status", render: (c) => <StatusPill status={c.status} /> },
        ]}
        exportName="clients"
        onBulkDelete={crud.removeMany}
        bulkActions={[{ label: "Mark Active", onClick: (rs) => crud.updateMany(rs, { status: "Active" } as never, "activated") }]}
        rowActions={(c) => crud.rowActions(c)}
      />
      {crud.modals}
    </>
  );
}
