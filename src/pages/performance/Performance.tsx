import { Target } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ChartCard, StatCard } from "@/components/StatCard";
import { Donut } from "@/components/charts";
import { AvatarName, Progress } from "@/components/ui";
import { byId } from "@/data/core";
import { objectives } from "@/data/people2";

export default function Performance() {
  const avg = Math.round(objectives.reduce((a, o) => a + o.progress, 0) / objectives.length);
  return (
    <>
      <PageHeader title="Performance" />
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Objectives" value={objectives.length} icon={Target} />
        <StatCard label="Average Progress" value={`${avg}%`} />
        <StatCard label="On Track" value={objectives.filter((o) => o.progress >= 50).length} />
        <StatCard label="At Risk" value={objectives.filter((o) => o.progress < 50).length} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard title="Objectives by Type">
          <Donut
            centerLabel="objectives"
            segments={[
              { label: "Company", value: objectives.filter((o) => o.type === "Company").length, color: "#5b5ceb" },
              { label: "Team", value: objectives.filter((o) => o.type === "Team").length, color: "#1fa971" },
              { label: "Individual", value: objectives.filter((o) => o.type === "Individual").length, color: "#e8983c" },
            ]}
          />
        </ChartCard>
        <ChartCard title="Progress by Objective">
          <ul className="space-y-4">
            {objectives.map((o) => (
              <li key={o.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{o.title}</span>
                  <AvatarName name={byId(o.owner)?.name ?? "—"} size={22} />
                </div>
                <Progress value={o.progress} />
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </>
  );
}
