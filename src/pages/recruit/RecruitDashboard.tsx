import { PageHeader } from "@/components/PageHeader";
import { ChartCard, StatCard } from "@/components/StatCard";
import { Donut } from "@/components/charts";
import { StatusPill } from "@/components/ui";
import { applications, funnel, interviews, jobs } from "@/data/recruit";
import { todayISO } from "@/lib/format";

const CELL: Record<string, string> = {
  applied: "bg-ink text-white",
  phone: "bg-warn text-white",
  interview: "bg-info text-white",
  hired: "bg-good text-white",
  rejected: "bg-bad text-white",
};

export default function RecruitDashboard() {
  return (
    <>
      <PageHeader title="Recruit Dashboard" crumbs={["Recruit"]} />
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total Openings" value={jobs.reduce((a, j) => a + j.openings, 0)} />
        <StatCard label="Total Applications" value={91} />
        <StatCard label="Total Hired" value={20} />
        <StatCard label="Total Rejected" value={18} />
        <StatCard label="New Applications" value={applications.filter((a) => a.status === "Applied").length} />
        <StatCard label="Shortlisted Candidates" value={32} />
        <StatCard label="Today's Interviews" value={interviews.filter((i) => i.date === todayISO()).length} />
        <StatCard label="Open Jobs" value={jobs.length} />
      </div>

      <ChartCard title="Total Applications — hiring funnel">
        <div className="overflow-x-auto">
          <table className="tbl w-full text-sm">
            <thead>
              <tr><th>Jobs</th><th>Applied</th><th>Phone Screen</th><th>Interview</th><th>Hired</th><th>Rejected</th></tr>
            </thead>
            <tbody>
              {funnel.map((f) => (
                <tr key={f.job}>
                  <td>
                    <span className="block font-medium">{f.job}</span>
                    <span className="text-xs text-faint">Total Applications — {f.total}</span>
                  </td>
                  {(["applied", "phone", "interview", "hired", "rejected"] as const).map((k) => (
                    <td key={k}>
                      <span className={`inline-block min-w-24 rounded px-3 py-1.5 text-center text-xs font-semibold ${CELL[k]}`}>
                        {f[k]} Candidate{f[k] === 1 ? "" : "s"}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard title="Today's Interviews">
          <ul className="divide-y divide-line">
            {interviews.filter((i) => i.date === todayISO()).map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="block font-medium">{i.candidate}</span>
                  <span className="text-xs text-muted">{i.job}</span>
                </span>
                <span className="text-xs text-muted tabular-nums">{i.time}</span>
                <StatusPill status={i.status} />
              </li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard title="Applications by Status">
          <Donut
            centerLabel="applications"
            segments={[
              { label: "Applied", value: applications.filter((a) => a.status === "Applied").length, color: "#8b94a7" },
              { label: "Phone Screen", value: applications.filter((a) => a.status === "Phone Screen").length, color: "#e8983c" },
              { label: "Interview", value: applications.filter((a) => a.status === "Interview").length, color: "#3fa9f5" },
              { label: "Hired", value: applications.filter((a) => a.status === "Hired").length, color: "#1fa971" },
              { label: "Rejected", value: applications.filter((a) => a.status === "Rejected").length, color: "#e85d51" },
            ]}
          />
        </ChartCard>
      </div>
    </>
  );
}
