/* Reusable record sub-panels: activity timeline, comment thread, attachments.
   Used by tickets, clients, projects, employees, invoices — anything with a history. */
import { Download, FileText, Paperclip, Send, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar } from "./ui";
import { api } from "@/lib/api";
import { CURRENT_USER, useToast } from "@/lib/store";
import { todayISO } from "@/lib/format";

export type ActivityItem = { id: string; by: string; text: string; time: string; kind?: string };
export type CommentItem = { id: string; by: string; text: string; time: string };
export type FileItem = { id: string; name: string; size: string; by: string; date: string };

const now = () =>
  new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0)
    return <p className="py-8 text-center text-sm text-faint">No activity recorded yet.</p>;
  return (
    <ul className="relative space-y-4 py-1">
      {items.map((a, i) => (
        <li key={a.id} className="relative flex gap-3 pl-1 text-sm">
          {i < items.length - 1 && <span className="absolute top-9 left-[19px] h-full w-px bg-line" />}
          <Avatar name={a.by} size={30} />
          <div className="min-w-0 flex-1">
            <p>
              <span className="font-bold">{a.by}</span> <span className="text-muted">{a.text}</span>
            </p>
            <p className="mt-0.5 text-xs text-faint">{a.time}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CommentThread({
  comments,
  onAdd,
  placeholder = "Write a comment…",
}: {
  comments: CommentItem[];
  onAdd: (c: CommentItem) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const send = () => {
    if (!draft.trim()) return;
    onAdd({ id: `c-${Date.now()}`, by: CURRENT_USER.name, text: draft.trim(), time: now() });
    setDraft("");
  };
  return (
    <div>
      <ul className="space-y-3.5">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3 text-sm">
            <Avatar name={c.by} size={30} />
            <div className="min-w-0 flex-1 rounded-xl border border-line bg-white/70 px-3.5 py-2.5">
              <p className="flex items-baseline gap-2">
                <span className="font-bold">{c.by}</span>
                <span className="text-xs text-faint">{c.time}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-muted">{c.text}</p>
            </div>
          </li>
        ))}
        {comments.length === 0 && <li className="py-6 text-center text-sm text-faint">No comments yet.</li>}
      </ul>
      <div className="mt-4 flex items-end gap-2 rounded-xl border border-line bg-white p-1.5">
        <textarea
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          className="max-h-28 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-faint"
        />
        <button className="btn-primary px-3 py-1.5" onClick={send} aria-label="Post comment">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

export function Attachments({
  files,
  onAdd,
  onRemove,
  collection,
  recordId,
}: {
  files: FileItem[];
  onAdd: (f: FileItem) => void;
  onRemove?: (id: string) => void;
  collection?: string;
  recordId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  const handle = (list: FileList | null) => {
    if (!list) return;
    Array.from(list).forEach((f) => {
      const item: FileItem = {
        id: `f-${Date.now()}-${f.name}`,
        name: f.name,
        size: f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`,
        by: CURRENT_USER.name,
        date: todayISO(),
      };
      onAdd(item);
      if (collection) void api.create("attachments", { ...item, collection, recordId });
    });
    push("File attached");
  };

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handle(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-page/50 py-7 text-sm text-muted hover:border-primary hover:text-primary"
      >
        <UploadCloud size={22} className="text-faint" />
        <span className="font-medium">Drop files here or click to upload</span>
        <span className="text-xs text-faint">PDF, images, documents — up to 25 MB</span>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handle(e.target.files)} />
      </div>
      <ul className="mt-3 space-y-2">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/70 px-3.5 py-2.5 text-sm">
            <FileText size={17} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{f.name}</span>
              <span className="text-xs text-faint">{f.size} · {f.by} · {f.date}</span>
            </span>
            <button className="btn-ghost px-1.5 py-1" aria-label="Download" onClick={() => push(`Downloading ${f.name}`)}>
              <Download size={14} />
            </button>
            {onRemove && (
              <button className="btn-ghost px-1.5 py-1 text-bad" aria-label="Remove file" onClick={() => onRemove(f.id)}>
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
        {files.length === 0 && (
          <li className="flex items-center gap-2 py-2 text-xs text-faint">
            <Paperclip size={12} /> No files attached yet
          </li>
        )}
      </ul>
    </div>
  );
}
