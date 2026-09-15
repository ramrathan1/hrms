import clsx from "clsx";
import { BookOpen, Eye, Plus, Search, ThumbsUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useCrud } from "@/components/crud";
import { can } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Modal } from "@/components/ui";
import { kbArticles } from "@/data/ops";
import { api } from "@/lib/api";
import { fmtDate, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

type Article = (typeof kbArticles)[number] & { body?: string; helpful?: number };

const CATEGORIES = ["Projects", "Support", "Billing", "HR", "Security", "General"];
const CAT_TINT: Record<string, string> = {
  Projects: "bg-primary-soft text-primary",
  Support: "bg-info-soft text-info",
  Billing: "bg-good-soft text-good",
  HR: "bg-warn-soft text-[#a9720e]",
  Security: "bg-bad-soft text-bad",
  General: "bg-page text-muted",
};

export default function Knowledge() {
  const [reading, setReading] = useState<Article | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [helpful, setHelpful] = useState<Record<string, number>>({});
  const { push } = useToast();

  const crud = useCrud<Article>({
    collection: "kbArticles",
    seed: kbArticles,
    itemName: "Article",
    withView: false,
    fields: [
      { key: "title", label: "Article Title", required: true, span: true },
      { key: "category", label: "Category", type: "select", options: CATEGORIES },
      { key: "body", label: "Article Content", type: "textarea", required: true },
    ],
    defaults: { views: 0, updated: todayISO(), category: "General" } as never,
  });

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    crud.items.forEach((a) => (m[a.category] = (m[a.category] ?? 0) + 1));
    return m;
  }, [crud.items]);

  const rows = crud.items.filter(
    (a) =>
      (cat === "All" || a.category === cat) &&
      (a.title + (a.body ?? "") + a.category).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Knowledge Base"
        actions={
          can("knowledge:create") ? (
            <button className="btn-primary" onClick={crud.openNew}>
              <Plus size={15} /> Add Article
            </button>
          ) : undefined
        }
      />

      {/* search hero */}
      <div className="card mb-5 px-6 py-6 text-center">
        <h2 className="font-display text-lg font-bold">How can we help?</h2>
        <p className="mt-1 text-sm text-muted">Search {crud.items.length} articles across {Object.keys(counts).length} categories</p>
        <span className="relative mx-auto mt-4 block max-w-lg">
          <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search articles, e.g. “invoice status” or “leave policy”…"
            className="input w-full py-2.5 pl-10"
          />
        </span>
      </div>

      {/* category filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={clsx(
              "btn rounded-full border px-3.5 py-1.5 text-xs font-semibold",
              cat === c ? "border-primary bg-primary text-white" : "border-line bg-white/70 text-muted hover:border-primary hover:text-primary"
            )}
          >
            {c}
            <span className={clsx("ml-1.5 tabular-nums", cat === c ? "text-white/70" : "text-faint")}>
              {c === "All" ? crud.items.length : counts[c] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((a) => (
          <div key={a.id} className="card flex flex-col p-5">
            <span className={clsx("mb-3 self-start rounded-full px-2.5 py-1 text-[11px] font-bold", CAT_TINT[a.category] ?? CAT_TINT.General)}>
              {a.category}
            </span>
            <button className="cursor-pointer text-left font-semibold hover:text-primary" onClick={() => setReading(a)}>
              {a.title}
            </button>
            <p className="mt-1.5 line-clamp-2 text-xs text-muted">
              {a.body ?? "Open this article to read the full guide."}
            </p>
            <p className="mt-3 flex items-center gap-3 text-xs text-faint">
              <span className="flex items-center gap-1"><Eye size={11} /> {a.views}</span>
              <span className="flex items-center gap-1"><ThumbsUp size={11} /> {helpful[a.id] ?? a.helpful ?? 0}</span>
              <span className="ml-auto">Updated {fmtDate(a.updated)}</span>
            </p>
            <div className="mt-3 flex gap-2 border-t border-line pt-3">
              <button className="btn-outline flex-1 px-2.5 py-1 text-xs" onClick={() => setReading(a)}>Read</button>
              <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => crud.openEdit(a)}>Edit</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="card col-span-full flex flex-col items-center gap-2 py-14 text-sm text-faint">
            <BookOpen size={26} />
            No articles match “{q || cat}”.
            {can("knowledge:create") && (
              <button className="btn-primary mt-2 px-3 py-1.5 text-xs" onClick={crud.openNew}>Write the first one</button>
            )}
          </div>
        )}
      </div>

      <Modal open={reading !== null} onClose={() => setReading(null)} title={reading?.title ?? ""} wide>
        <p className="mb-3 flex items-center gap-2 text-xs text-muted">
          <span className={clsx("rounded-full px-2 py-0.5 font-bold", CAT_TINT[reading?.category ?? "General"])}>{reading?.category}</span>
          Updated {reading ? fmtDate(reading.updated) : ""} · {reading?.views} views
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {reading?.body ??
            "This article hasn't been written yet — hit Edit to add its content. Articles support step-by-step guides, FAQ answers, and policy documents that employees and clients can self-serve."}
        </p>
        <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
          <span className="text-sm text-muted">Was this helpful?</span>
          <button
            className="btn-outline px-3 py-1.5 text-xs"
            onClick={() => {
              if (!reading) return;
              const n = (helpful[reading.id] ?? reading.helpful ?? 0) + 1;
              setHelpful((h) => ({ ...h, [reading.id]: n }));
              void api.update("kbArticles", reading.id, { helpful: n });
              push("Thanks for the feedback");
            }}
          >
            <ThumbsUp size={13} /> Yes
          </button>
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => push("Noted — we'll improve this article")}>
            No
          </button>
        </div>
      </Modal>
      {crud.modals}
    </>
  );
}
