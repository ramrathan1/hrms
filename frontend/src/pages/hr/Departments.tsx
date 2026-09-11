import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { Tree } from "@/components/Tree";
import { Tabs } from "@/components/ui";
import { departments } from "@/data/core";

export default function Departments() {
  const [tab, setTab] = useState("List");
  const crud = useCrud({
    collection: "departments",
    seed: departments,
    itemName: "Department",
    fields: [
      { key: "name", label: "Department Name", required: true },
      { key: "parent", label: "Parent Department", type: "select", options: ["", ...departments.map((d) => d.name)] },
      { key: "members", label: "Members", type: "number" },
    ],
    defaults: { parent: null, members: 0 } as never,
  });
  return (
    <>
      <PageHeader
        title="Department"
        crumbs={["HR"]}
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Add Department
          </button>
        }
      />
      <div className="card mb-5 px-2">
        <Tabs tabs={["List", "Hierarchy"]} active={tab} onChange={setTab} className="border-b-0" />
      </div>
      {tab === "List" ? (
        <DataTable
          rows={crud.items}
          selectable={false}
          columns={[
            { key: "name", label: "Name", sort: (d) => d.name, render: (d) => <span className="font-medium">{d.name}</span> },
            { key: "parent", label: "Parent", render: (d) => d.parent || "--" },
            { key: "members", label: "Members", className: "tabular-nums" },
          ]}
          rowActions={(d) => crud.rowActions(d)}
        />
      ) : (
        <div className="card">
          <Tree
            root={{
              label: "Worksuite",
              sub: "Company",
              children: crud.items
                .filter((d) => !d.parent)
                .map((d) => ({
                  label: d.name,
                  sub: `${d.members} members`,
                  children: crud.items.filter((c) => c.parent === d.name).map((c) => ({ label: c.name, sub: `${c.members} members` })),
                })),
            }}
          />
        </div>
      )}
      {crud.modals}
    </>
  );
}
