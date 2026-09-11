import { Download, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { FilterBar, PageHeader } from "@/components/PageHeader";
import { AvatarName, SearchInput, Select, StatusPill } from "@/components/ui";
import { employees } from "@/data/core";
import { useToast } from "@/lib/store";

export default function Employees() {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  const nav = useNavigate();
  const { push } = useToast();
  const crud = useCrud({
    collection: "employees",
    seed: employees,
    itemName: "Employee",
    onView: (e) => nav(`/hr/employees/${e.id}`),
    fields: [
      { key: "name", label: "Full Name", required: true },
      { key: "email", label: "Email", required: true },
      { key: "phone", label: "Phone" },
      { key: "designation", label: "Designation", type: "select", options: ["Team Lead", "Project Manager", "Senior Developer", "Junior Developer", "QA Engineer", "Junior Designer", "Trainee", "Recruiter"] },
      { key: "department", label: "Department", type: "select", options: ["Engineering", "Design", "Delivery", "Human Resource"] },
      { key: "hourly", label: "Hourly Rate ($)", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["Active", "On Leave", "Exited"] },
    ],
  });
  const rows = crud.items.filter(
    (e) =>
      (dept === "All" || e.department === dept) &&
      (e.name + e.email + e.designation).toLowerCase().includes(q.toLowerCase())
  );
  return (
    <>
      <PageHeader
        title="Employees"
        crumbs={["HR"]}
        actions={
          <>
            <Link to="/hr/employees/new" className="btn-primary">
              <Plus size={15} /> Add Employee
            </Link>
            <button className="btn-outline" onClick={() => push("Invite email queued — configure SMTP in Settings → Notifications")}>
              <UserPlus size={15} /> Invite Employee
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                const csv = ["Id,Name,Email,Designation,Department,Status", ...rows.map((e) => [e.code ?? e.id, e.name, e.email, e.designation, e.department, e.status].join(","))].join("\n");
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                a.download = "employees.csv";
                a.click();
                push("employees.csv downloaded");
              }}
            >
              <Download size={15} /> Export
            </button>
          </>
        }
      />
      <FilterBar>
        <Select label="Department" value={dept} onChange={setDept} options={["All", "Engineering", "Design", "Delivery", "Human Resource"]} />
        <SearchInput value={q} onChange={setQ} />
      </FilterBar>
      <DataTable
        rows={rows}
        columns={[
          { key: "code", label: "Employee Id", sort: (e) => e.code ?? e.id, render: (e) => e.code ?? "—" },
          { key: "name", label: "Name", sort: (e) => e.name, render: (e) => <Link to={`/hr/employees/${e.id}`}><AvatarName name={e.name} sub={e.designation} /></Link> },
          { key: "email", label: "Email" },
          { key: "department", label: "Department", sort: (e) => e.department },
          { key: "reportsTo", label: "Reporting To", render: (e) => employees.find((x) => x.id === e.reportsTo)?.name ?? "--" },
          { key: "status", label: "Status", render: (e) => <StatusPill status={e.status} /> },
        ]}
        exportName="employees"
        onBulkDelete={crud.removeMany}
        bulkActions={[{ label: "Mark Active", onClick: (rs) => crud.updateMany(rs, { status: "Active" } as never, "activated") }]}
        rowActions={(e) => crud.rowActions(e)}
      />
      {crud.modals}
    </>
  );
}
