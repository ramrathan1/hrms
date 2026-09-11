import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { AvatarName, Tabs } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { appreciations, awards } from "@/data/hr";
import { fmtDate, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function Appreciations() {
  const [tab, setTab] = useState("Appreciation");
  const crud = useCrud({
    collection: "appreciations",
    seed: appreciations,
    itemName: "Appreciation",
    fields: [
      { key: "award", label: "Award", type: "select", options: awards.map((a) => a.name), required: true },
      { key: "employee", label: "Given To", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })), required: true },
      { key: "givenBy", label: "Given By", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })) },
      { key: "date", label: "Date", type: "date" },
    ],
    defaults: { date: todayISO(), photo: "🏅" } as never,
  });
  const awardsCrud = useCrud({
    collection: "awards",
    seed: awards,
    itemName: "Award",
    fields: [
      { key: "name", label: "Award Name", required: true },
      { key: "icon", label: "Icon (emoji)", placeholder: "🏆" },
      { key: "summary", label: "Summary", type: "textarea" },
    ],
    defaults: { given: 0, icon: "🏆" } as never,
  });
  return (
    <>
      <PageHeader
        title="Appreciation"
        crumbs={["HR"]}
        actions={
          <button className="btn-primary" onClick={tab === "Appreciation" ? crud.openNew : awardsCrud.openNew}>
            <Plus size={15} /> {tab === "Appreciation" ? "Give Appreciation" : "Add Award"}
          </button>
        }
      />
      <div className="card mb-5 px-2">
        <Tabs tabs={["Appreciation", "Awards"]} active={tab} onChange={setTab} className="border-b-0" />
      </div>
      {tab === "Appreciation" ? (
        <DataTable
          rows={crud.items}
          selectable={false}
          columns={[
            { key: "photo", label: "", render: (a) => <span className="text-2xl">{a.photo}</span>, className: "w-12" },
            { key: "award", label: "Award Name", render: (a) => <span className="font-medium">{a.award}</span> },
            { key: "employee", label: "Given To", render: (a) => <AvatarName name={byId(a.employee)?.name ?? "—"} size={28} /> },
            { key: "givenBy", label: "Given By", render: (a) => byId(a.givenBy)?.name },
            { key: "date", label: "Date", sort: (a) => a.date, render: (a) => fmtDate(a.date) },
          ]}
          rowActions={(a) => crud.rowActions(a)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {awardsCrud.items.map((a) => (
            <div key={a.id} className="card flex items-center gap-4 px-5 py-5">
              <span className="text-4xl">{a.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.name}</p>
                <p className="text-xs text-muted">{a.summary}</p>
                <p className="mt-1 text-xs font-medium text-primary">{a.given} times given</p>
              </div>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => awardsCrud.openEdit(a)}>Edit</button>
            </div>
          ))}
        </div>
      )}
      {crud.modals}
      {awardsCrud.modals}
    </>
  );
}
