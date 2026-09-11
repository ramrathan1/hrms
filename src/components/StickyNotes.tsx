/* Personal sticky notes — quick scratch pad in the topbar, kept per user. */
import clsx from "clsx";
import { Plus, StickyNote, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Note = { id: string; text: string; colour: string };
const COLOURS = ["#fff6cc", "#e6f3fe", "#e4f6ee", "#fdebe9", "#efeafc"];
const KEY = "ws.notes";

export function StickyNotes() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Note[];
    } catch {
      return [];
    }
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(notes));
    } catch {
      /* storage unavailable */
    }
  }, [notes]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const add = () =>
    setNotes((ns) => [
      { id: `n-${Date.now()}`, text: "", colour: COLOURS[ns.length % COLOURS.length] },
      ...ns,
    ]);

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative px-2" onClick={() => setOpen((o) => !o)} aria-label="Sticky notes">
        <StickyNote size={17} />
        {notes.length > 0 && (
          <span className="absolute top-0.5 right-1 h-1.5 w-1.5 rounded-full bg-warn" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">My notes</span>
            <span className="flex items-center gap-1">
              <button className="cursor-pointer rounded-md p-1 text-primary hover:bg-page" onClick={add} aria-label="Add note">
                <Plus size={15} />
              </button>
              <button className="cursor-pointer rounded-md p-1 text-faint hover:bg-page" onClick={() => setOpen(false)} aria-label="Close notes">
                <X size={15} />
              </button>
            </span>
          </div>
          <div className="max-h-96 space-y-2.5 overflow-y-auto p-3">
            {notes.map((n) => (
              <div key={n.id} className="group relative rounded-xl p-2.5" style={{ background: n.colour }}>
                <textarea
                  rows={3}
                  value={n.text}
                  autoFocus={n.text === ""}
                  placeholder="Jot something down…"
                  onChange={(e) => setNotes((ns) => ns.map((x) => (x.id === n.id ? { ...x, text: e.target.value } : x)))}
                  className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-ink/35"
                />
                <div className="mt-1 flex items-center gap-1">
                  {COLOURS.map((c) => (
                    <button
                      key={c}
                      aria-label="Note colour"
                      onClick={() => setNotes((ns) => ns.map((x) => (x.id === n.id ? { ...x, colour: c } : x)))}
                      className={clsx("h-3.5 w-3.5 cursor-pointer rounded-full border", n.colour === c ? "border-ink/40" : "border-black/10")}
                      style={{ background: c }}
                    />
                  ))}
                  <button
                    className="ml-auto cursor-pointer rounded p-1 text-ink/40 hover:text-bad"
                    aria-label="Delete note"
                    onClick={() => setNotes((ns) => ns.filter((x) => x.id !== n.id))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            {notes.length === 0 && (
              <button className="flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-line py-8 text-sm text-faint hover:border-primary hover:text-primary" onClick={add}>
                <StickyNote size={20} />
                Add your first note
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
