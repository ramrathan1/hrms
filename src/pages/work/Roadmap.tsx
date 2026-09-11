import { ChevronUp, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill, Tabs } from "@/components/ui";
import { useCrud } from "@/components/crud";
import { roadmapIdeas } from "@/data/work";
import { useToast } from "@/lib/store";

const LANES = ["Under Review", "Planned", "In Progress", "Shipped"];

export default function Roadmap() {
  const [tab, setTab] = useState("Board");
  const [votes, setVotes] = useState<Record<string, number>>(Object.fromEntries(roadmapIdeas.map((r) => [r.id, r.votes])));
  const { push } = useToast();
  const crud = useCrud({
    collection: "roadmapIdeas",
    seed: roadmapIdeas,
    itemName: "Idea",
    fields: [
      { key: "title", label: "Idea Title", required: true, span: true },
      { key: "category", label: "Category", type: "select", options: ["UI", "Integrations", "Reports", "Timesheet", "Files", "Other"] },
      { key: "status", label: "Status", type: "select", options: ["Under Review", "Planned", "In Progress", "Shipped"] },
    ],
    defaults: { votes: 1, status: "Under Review" } as never,
  });
  return (
    <>
      <PageHeader
        title="Project Roadmap"
        crumbs={["Work"]}
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Submit Idea
          </button>
        }
      />
      <div className="card mb-5 px-2">
        <Tabs tabs={["Board", "List"]} active={tab} onChange={setTab} className="border-b-0" />
      </div>
      {tab === "Board" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {LANES.map((lane) => (
            <div key={lane} className="rounded-lg border border-line bg-white/40 backdrop-blur-md">
              <div className="border-b border-line px-4 py-3 text-sm font-semibold">{lane}</div>
              <div className="space-y-3 p-3">
                {crud.items.filter((r) => r.status === lane).map((r) => (
                  <div key={r.id} className="card p-4">
                    <p className="text-sm font-semibold">{r.title}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="rounded bg-page px-2 py-0.5 text-xs text-muted">{r.category}</span>
                      <button
                        className="btn-outline gap-1 px-2.5 py-1 text-xs"
                        onClick={() => {
                          setVotes((v) => ({ ...v, [r.id]: (v[r.id] ?? r.votes) + 1 }));
                          push("Vote counted");
                        }}
                      >
                        <ChevronUp size={13} /> {votes[r.id] ?? r.votes}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card divide-y divide-line">
          {crud.items.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-5 py-3.5 text-sm">
              <button
                className="btn-outline gap-1 px-2.5 py-1 text-xs"
                onClick={() => setVotes((v) => ({ ...v, [r.id]: (v[r.id] ?? r.votes) + 1 }))}
              >
                <ChevronUp size={13} /> {votes[r.id] ?? r.votes}
              </button>
              <span className="flex-1 font-medium">{r.title}</span>
              <span className="text-muted">{r.category}</span>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      )}
      {crud.modals}
    </>
  );
}
