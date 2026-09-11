import { Download, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConvertLeadModal } from "@/components/ConvertModals";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { AvatarName, SearchInput, Select } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { leads } from "@/data/crm";
import { fmtDate, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function Leads() {
  const [q, setQ] = useState("");
  const [source, setSource] = useState("All");
  const nav = useNavigate();
  const { push } = useToast();
  const [converting, setConverting] = useState<(typeof leads)[number] | null>(null);
  const crud = useCrud({
    collection: "leads",
    seed: leads,
    itemName: "Lead Contact",
    onView: (l) => nav(`/leads/${l.id}`),
    fields: [
      { key: "name", label: "Contact Name", required: true },
      { key: "company", label: "Company Name" },
      { key: "email", label: "Email", required: true },
      { key: "phone", label: "Phone" },
      { key: "source", label: "Lead Source", type: "select", options: ["Google", "Email", "Facebook", "Direct", "Friend", "Tv"] },
      { key: "owner", label: "Lead Owner", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })) },
      { key: "added", label: "Created", type: "date" },
    ],
    defaults: { added: todayISO() } as never,
  });
  const rows = crud.items.filter(
    (l) =>
      (source === "All" || l.source === source) &&
      (l.name + l.company + l.email).toLowerCase().includes(q.toLowerCase())
  );
  return (
    <>
      <PageHeader
        title="Lead Contacts"
        crumbs={["Leads"]}
        actions={
          <>
            <button className="btn-primary" onClick={crud.openNew}>
              <Plus size={15} /> Add Lead Contact
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                const csv = ["Name,Company,Email,Phone,Source", ...rows.map((l) => [l.name, l.company, l.email, l.phone, l.source].join(","))].join("\n");
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                a.download = "lead-contacts.csv";
                a.click();
                push("lead-contacts.csv downloaded");
              }}
            >
              <Download size={15} /> Export
            </button>
          </>
        }
      />
      <FilterBar>
        <DurationFilter />
        <Select label="Source" value={source} onChange={setSource} options={["All", "Google", "Email", "Facebook", "Direct", "Friend", "Tv"]} />
        <SearchInput value={q} onChange={setQ} />
      </FilterBar>
      <DataTable
        rows={rows}
        columns={[
          { key: "name", label: "Contact Name", sort: (r) => r.name, render: (r) => <button className="cursor-pointer text-left" onClick={() => nav(`/leads/${r.id}`)}><AvatarName name={r.name} sub={r.company} /></button> },
          { key: "email", label: "Email", sort: (r) => r.email },
          { key: "phone", label: "Phone" },
          { key: "source", label: "Lead Source", sort: (r) => r.source },
          { key: "owner", label: "Lead Owner", render: (r) => <AvatarName name={byId(r.owner)?.name ?? "—"} size={28} /> },
          { key: "added", label: "Created", sort: (r) => r.added, render: (r) => fmtDate(r.added) },
        ]}
        exportName="lead-contacts"
        onBulkDelete={crud.removeMany}
        rowActions={(r) =>
          crud.rowActions(r, [{ label: "Convert to Client", onClick: () => setConverting(r) }])
        }
      />
      <ConvertLeadModal
        lead={converting}
        onClose={() => setConverting(null)}
        onDone={(cid) => {
          crud.setItems(crud.items.filter((l) => l.id !== converting?.id));
          nav(`/clients/${cid}`);
        }}
      />
      {crud.modals}
    </>
  );
}
