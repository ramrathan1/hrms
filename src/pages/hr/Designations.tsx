import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { Tree, type TreeNode } from "@/components/Tree";
import { Tabs } from "@/components/ui";
import { designations, employees } from "@/data/core";
import { useToast } from "@/lib/store";

function buildTree(parent: string | null): TreeNode[] {
  return designations
    .filter((d) => d.parent === parent)
    .map((d) => ({
      label: d.name,
      sub: `${employees.filter((e) => e.designation === d.name).length} people`,
      children: buildTree(d.name),
    }));
}

export default function Designations() {
  const [tab, setTab] = useState("List");
  const crud = useCrud({
    collection: "designations",
    seed: designations,
    itemName: "Designation",
    fields: [
      { key: "name", label: "Designation Name", required: true },
      { key: "parent", label: "Parent Designation", type: "select", options: ["", ...designations.map((d) => d.name)] },
    ],
    defaults: { parent: null } as never,
  });
  return (
    <>
      <PageHeader
        title="Designation"
        crumbs={["HR"]}
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Add Designation
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
            { key: "parent", label: "Parent Designation", render: (d) => d.parent || "--" },
            { key: "count", label: "Employees", render: (d) => employees.filter((e) => e.designation === d.name).length, className: "tabular-nums" },
          ]}
          rowActions={(d) => crud.rowActions(d)}
        />
      ) : (
        <div className="card">
          <Tree root={{ label: "Leadership", sub: "Top level", children: buildTree(null) }} />
        </div>
      )}
      {crud.modals}
    </>
  );
}
