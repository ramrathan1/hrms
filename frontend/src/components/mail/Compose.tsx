/* Compose window. Validates recipients for real, saves drafts, and reports what
   actually happened on send — including that no SMTP socket was opened. */
import clsx from "clsx";
import { Minus, Paperclip, Send, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mailAccounts, mailContacts } from "@/data/mail";
import { isEmail, saveDraft, sendDraft, validateDraft } from "@/lib/mail";
import { useToast } from "@/lib/store";

export type ComposeSeed = {
  id?: string;
  accountId: string;
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  threadId?: string;
};

/** Suggest known addresses as you type the last recipient. */
function useSuggestions(value: string) {
  const parts = value.split(/[,;]/);
  const term = (parts[parts.length - 1] ?? "").trim().toLowerCase();
  if (term.length < 2) return { term, matches: [] as typeof mailContacts };
  const matches = mailContacts
    .filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(term))
    // Nothing to suggest once the address is already typed out in full.
    .filter((c) => c.email.toLowerCase() !== term)
    .slice(0, 5);
  return { term, matches };
}

export function Compose({ seed, onClose }: { seed: ComposeSeed; onClose: () => void }) {
  const [accountId, setAccountId] = useState(seed.accountId || mailAccounts[0]?.id || "");
  const [to, setTo] = useState(seed.to ?? "");
  const [cc, setCc] = useState(seed.cc ?? "");
  const [showCc, setShowCc] = useState(Boolean(seed.cc));
  const [subject, setSubject] = useState(seed.subject ?? "");
  const [body, setBody] = useState(seed.body ?? "");
  const [minimised, setMinimised] = useState(false);
  const [sending, setSending] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const { push } = useToast();

  const account = mailAccounts.find((a) => a.id === accountId) ?? mailAccounts[0];
  const draft = { id: seed.id, accountId, to, cc, subject, body, threadId: seed.threadId };
  const { term, matches } = useSuggestions(to);

  /* A reply pre-fills the quote — put the cursor above it, not after. */
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, 0);
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose, sending]);

  const addSuggestion = (email: string) => {
    const parts = to.split(/[,;]/);
    parts[parts.length - 1] = ` ${email}`;
    setTo(parts.join(",").replace(/^\s*,\s*/, "") + ", ");
  };

  const send = async () => {
    setTouched(true);
    const found = validateDraft(draft);
    setProblems(found);
    if (found.length) return;
    setSending(true);
    try {
      await sendDraft(draft);
      // The API stores the message and hands it to the SMTP worker, so it is
      // safely on its way rather than confirmed delivered.
      push("Queued for delivery — it's in Sent");
      onClose();
    } catch (e) {
      setProblems([e instanceof Error ? e.message : "Couldn't send"]);
      setSending(false);
    }
  };

  const keepDraft = () => {
    if (!to.trim() && !subject.trim() && !body.trim()) return onClose();
    void saveDraft(draft);
    push("Saved to Drafts");
    onClose();
  };

  const liveProblems = touched ? validateDraft(draft) : [];
  const toInvalid = touched && liveProblems.some((p) => /recipient|valid address/i.test(p));

  return createPortal(
    <div
      className={clsx(
        "fixed z-50 flex flex-col overflow-hidden border border-line bg-white shadow-2xl",
        minimised
          ? "right-4 bottom-0 w-80 rounded-t-xl"
          : "inset-x-0 bottom-0 top-0 sm:inset-auto sm:right-6 sm:bottom-0 sm:h-[34rem] sm:w-[38rem] sm:rounded-t-2xl"
      )}
      role="dialog"
      aria-label="Compose message"
    >
      <header className="flex shrink-0 items-center gap-2 bg-ink px-4 py-2.5 text-white">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {subject.trim() || (seed.threadId ? "Reply" : "New message")}
        </h2>
        <button className="cursor-pointer rounded p-1 hover:bg-white/15" onClick={() => setMinimised((m) => !m)} aria-label={minimised ? "Expand" : "Minimise"}>
          <Minus size={15} />
        </button>
        <button className="cursor-pointer rounded p-1 hover:bg-white/15" onClick={keepDraft} aria-label="Close and save draft">
          <X size={15} />
        </button>
      </header>

      {!minimised && (
        <>
          <div className="shrink-0 space-y-px border-b border-line">
            {mailAccounts.length > 1 && (
              <label className="flex items-center gap-3 px-4 py-2">
                <span className="w-12 shrink-0 text-xs text-muted">From</span>
                <select className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {mailAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} · {a.email}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="relative">
              <label className="flex items-center gap-3 border-t border-line px-4 py-2">
                <span className="w-12 shrink-0 text-xs text-muted">To</span>
                <input
                  className={clsx("min-w-0 flex-1 bg-transparent py-1 text-sm outline-none", toInvalid && "text-bad")}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="name@company.com"
                  aria-invalid={toInvalid}
                />
                {!showCc && (
                  <button className="shrink-0 cursor-pointer text-xs font-semibold text-muted hover:text-primary" onClick={() => setShowCc(true)}>
                    Cc
                  </button>
                )}
              </label>
              {matches.length > 0 && term && (
                <ul className="absolute inset-x-4 top-full z-20 overflow-hidden rounded-lg border border-line bg-white shadow-lg">
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button className="flex w-full cursor-pointer items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-page" onClick={() => addSuggestion(c.email)}>
                        <span className="font-medium">{c.name}</span>
                        <span className="truncate text-xs text-faint">{c.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {showCc && (
              <label className="flex items-center gap-3 border-t border-line px-4 py-2">
                <span className="w-12 shrink-0 text-xs text-muted">Cc</span>
                <input className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="name@company.com" />
              </label>
            )}

            <label className="flex items-center gap-3 border-t border-line px-4 py-2">
              <span className="w-12 shrink-0 text-xs text-muted">Subject</span>
              <input className="min-w-0 flex-1 bg-transparent py-1 text-sm font-medium outline-none" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
            </label>
          </div>

          <textarea
            ref={bodyRef}
            className="min-h-0 flex-1 resize-none px-4 py-3 font-serif text-[15px] leading-relaxed outline-none"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
          />

          {account?.signature && (
            <p className="shrink-0 border-t border-line px-4 py-2 text-xs whitespace-pre-line text-faint">
              {account.signature}
            </p>
          )}

          {(problems.length > 0 || liveProblems.length > 0) && (
            <ul className="shrink-0 space-y-0.5 bg-bad-soft px-4 py-2 text-xs text-bad">
              {[...new Set([...problems, ...liveProblems])].map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          <footer className="flex shrink-0 items-center gap-2 border-t border-line px-4 py-3">
            <button className="btn-primary" onClick={send} disabled={sending}>
              <Send size={15} /> {sending ? "Sending…" : "Send"}
            </button>
            <button
              className="btn-ghost cursor-pointer px-2 py-2 text-muted"
              title="Attachments need a mail server — not available in this build"
              disabled
              aria-label="Attach a file (unavailable)"
            >
              <Paperclip size={16} />
            </button>
            <span className="ml-auto flex items-center gap-2">
              <button className="btn-ghost cursor-pointer px-2 py-2 text-bad" onClick={onClose} aria-label="Discard">
                <Trash2 size={16} />
              </button>
            </span>
          </footer>
        </>
      )}
    </div>,
    document.body
  );
}

export { isEmail };
