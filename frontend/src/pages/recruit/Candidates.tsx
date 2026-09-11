import { Download } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { FilterBar, PageHeader } from "@/components/PageHeader";
import { AvatarName, Select } from "@/components/ui";
import { applications, jobs } from "@/data/recruit";
import { fmtDate } from "@/lib/format";
import { useFilters } from "@/lib/filters";
import { useToast } from "@/lib/store";

const ALL_SKILLS = Array.from(new Set(applications.flatMap((a) => a.skills ?? []))).sort();

export default function Candidates() {
  const { push } = useToast();
  const filters = useFilters<(typeof applications)[number]>([
    { label: "Skills", options: ["All", ...ALL_SKILLS], match: (a, v) => (a.skills ?? []).includes(v) },
    { label: "Job", options: ["All", ...jobs.map((j) => j.title)], match: (a, v) => jobs.find((j) => j.id === a.jobId)?.title === v },
    { label: "Status", options: ["All", "Applied", "Phone Screen", "Interview", "Hired", "Rejected"], match: (a, v) => a.status === v },
  ]);
  const shown = filters.apply(applications);
  return (
    <>
      <PageHeader
        title="Candidate Database"
        crumbs={["Recruit"]}
        actions={
          <button
            className="btn-outline"
            onClick={() => {
              const csv = [
                "Name,Email,Job,Location,Applied,Status,Skills",
                ...shown.map((a) =>
                  [a.name, a.email, jobs.find((j) => j.id === a.jobId)?.title ?? "", a.location, a.date, a.status, `"${(a.skills ?? []).join("; ")}"`].join(",")
                ),
              ].join("\n");
              const el = document.createElement("a");
              el.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              el.download = "candidate-database.csv";
              el.click();
              push(`${shown.length} candidates exported`);
            }}
          >
            <Download size={15} /> Export
          </button>
        }
      />
      <div className="card mb-5 px-5 py-3 text-sm text-muted">ℹ️ These are the archived job applications.</div>
      <FilterBar>
        {filters.controls.map((c) => <Select key={c.label} {...c} />)}
        <span className="ml-auto text-xs text-muted">{shown.length} of {applications.length} candidates</span>
      </FilterBar>
      <DataTable
        rows={shown}
        selectable={false}
        columns={[
          { key: "name", label: "Name", sort: (a) => a.name, render: (a) => <AvatarName name={a.name} sub={a.email} size={30} /> },
          { key: "job", label: "Job", render: (a) => jobs.find((j) => j.id === a.jobId)?.title },
          { key: "location", label: "Job Location" },
          { key: "date", label: "Job Applied", sort: (a) => a.date, render: (a) => fmtDate(a.date) },
          { key: "skills", label: "Skills", render: (a) => (
            <span className="flex flex-wrap gap-1">
              {(a.skills ?? []).map((k) => (
                <span key={k} className="rounded-md bg-page px-1.5 py-0.5 text-[11px] font-medium text-muted">{k}</span>
              ))}
            </span>
          ) },
        ]}
      />
    </>
  );
}
