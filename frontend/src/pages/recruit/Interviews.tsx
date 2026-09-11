import { Check, Plus, Star, X } from "lucide-react";
import { useState } from "react";
import { CalendarMonth } from "@/components/CalendarMonth";
import { useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, Modal } from "@/components/ui";
import { applications, interviews, jobs } from "@/data/recruit";
import { api } from "@/lib/api";
import { fmtDate, tomorrowISO } from "@/lib/format";
import { CURRENT_USER, useToast } from "@/lib/store";

const SCORE_AREAS = ["Technical skill", "Communication", "Culture fit", "Problem solving"];

export default function Interviews() {
  const { push } = useToast();
  const [scoreFor, setScoreFor] = useState<{ id: string; candidate: string; job: string } | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommend, setRecommend] = useState("Hire");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState<Record<string, { avg: number; recommend: string }>>({});
  const crud = useCrud({
    collection: "interviews",
    seed: interviews,
    itemName: "Interview",
    fields: [
      { key: "candidate", label: "Candidate", type: "select", options: applications.map((a) => a.name), required: true },
      { key: "job", label: "Job", type: "select", options: jobs.map((j) => j.title) },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "time", label: "Time", placeholder: "11:00 am", required: true },
      { key: "status", label: "Status", type: "select", options: ["Scheduled", "Completed", "Cancelled", "No Show"] },
    ],
    /* Tomorrow, not today: the server refuses an interview scheduled in the
       past, and "today at 11am" is already past for most of the day. */
    defaults: { date: tomorrowISO(), time: "11:00 am", status: "Scheduled" } as never,
  });
  return (
    <>
      <PageHeader
        title="Interview Schedule"
        crumbs={["Recruit"]}
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Add Interview Schedule
          </button>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CalendarMonth
            events={crud.items.map((i) => ({ date: i.date, title: `${i.time} ${i.candidate}`, color: "#5b5ceb" }))}
          />
        </div>
        <div className="card self-start">
          <div className="border-b border-line px-5 py-3.5 text-[15px] font-semibold">Interview Schedule</div>
          <ul className="divide-y divide-line">
            {crud.items.map((i) => (
              <li key={i.id} className="px-5 py-3.5 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-12 shrink-0 rounded-md border border-line py-1 text-center">
                    <p className="text-[10px] text-muted uppercase">Aug</p>
                    <p className="font-bold tabular-nums">{i.date.slice(8)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium"><Avatar name={i.candidate} size={20} /> {i.candidate}</p>
                    <p className="mt-0.5 text-xs text-muted">{fmtDate(i.date)} , {i.time} · {i.job}</p>
                    {submitted[i.id] ? (
                      <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-semibold text-good">
                        <Star size={10} /> Scored {submitted[i.id].avg.toFixed(1)}/5 · {submitted[i.id].recommend}
                      </p>
                    ) : (
                      <button
                        className="mt-1.5 cursor-pointer text-[11px] font-semibold text-primary hover:underline"
                        onClick={() => {
                          setScoreFor({ id: i.id, candidate: i.candidate, job: i.job });
                          setScores({});
                          setNotes("");
                          setRecommend("Hire");
                        }}
                      >
                        + Add interview feedback
                      </button>
                    )}
                    {i.status === "Needs Response" && (
                      <div className="mt-2 flex gap-2">
                        <button className="btn-primary px-2.5 py-1 text-xs" onClick={() => { crud.update(i.id, { status: "Accepted" } as never, true); push("Interview accepted"); }}>
                          <Check size={12} /> Accept
                        </button>
                        <button className="btn-outline px-2.5 py-1 text-xs" onClick={() => { crud.update(i.id, { status: "Rejected" } as never, true); push("Interview rejected"); }}>
                          <X size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Modal open={scoreFor !== null} onClose={() => setScoreFor(null)} title={`Interview scorecard — ${scoreFor?.candidate ?? ""}`} wide>
        <p className="mb-4 text-sm text-muted">{scoreFor?.job} · rate each area from 1 to 5.</p>
        <div className="space-y-3.5">
          {SCORE_AREAS.map((area) => (
            <div key={area} className="flex flex-wrap items-center gap-3">
              <span className="w-40 shrink-0 text-sm font-medium">{area}</span>
              <span className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setScores((s) => ({ ...s, [area]: n }))}
                    className={`btn h-8 w-8 rounded-lg border text-sm font-bold ${
                      (scores[area] ?? 0) >= n ? "border-primary bg-primary text-white" : "border-line bg-white text-muted hover:border-primary"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="lbl">Recommendation</span>
          <select className="input" value={recommend} onChange={(e) => setRecommend(e.target.value)}>
            {["Strong hire", "Hire", "Hold", "No hire"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="mt-3.5 block">
          <span className="lbl">Notes for the hiring team</span>
          <textarea rows={4} className="input resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Strengths, concerns, follow-up questions…" />
        </label>
        <div className="mt-5 flex gap-3">
          <button
            className="btn-primary"
            onClick={() => {
              const vals = SCORE_AREAS.map((a) => scores[a] ?? 0);
              const avg = vals.reduce((x, y) => x + y, 0) / SCORE_AREAS.length;
              if (avg === 0) return push("Score at least one area first");
              setSubmitted((s) => ({ ...s, [scoreFor!.id]: { avg, recommend } }));
              void api.create("interviewFeedback", { interviewId: scoreFor!.id, candidate: scoreFor!.candidate, scores, avg, recommend, notes, by: CURRENT_USER.id });
              push(`Feedback saved — ${avg.toFixed(1)}/5, ${recommend}`);
              setScoreFor(null);
            }}
          >
            Submit feedback
          </button>
          <button className="btn-ghost" onClick={() => setScoreFor(null)}>Cancel</button>
        </div>
      </Modal>
      {crud.modals}
    </>
  );
}
