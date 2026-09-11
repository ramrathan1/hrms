/* Mailbox: folder rail, conversation list, reading pane.
   Three panes on a desktop; on narrow screens the list and the reading pane
   take turns so the whole thing still works on a phone. */
import clsx from "clsx";
import {
  Archive, ChevronLeft, Inbox, Mail as MailIcon, MailOpen, Paperclip, Pencil, RefreshCw,
  Reply, ReplyAll, Search, Send, Settings2, Star, Tag, Trash2, TriangleAlert, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Compose, type ComposeSeed } from "@/components/mail/Compose";
import { Avatar, EmptyState } from "@/components/ui";
import { mailAccounts, mailFolders, type MailMessage } from "@/data/mail";
import {
  applyLabel, deleteMessages, loadAccounts, loadMailbox, markRead, moveTo, onMailChange,
  searchThreads, syncAccount, threadsIn, toggleStar, unreadIn,
  type MailThread,
} from "@/lib/mail";
import { onStoreChange } from "@/lib/api";
import { useToast } from "@/lib/store";

const FOLDER_ICON = {
  inbox: Inbox, starred: Star, sent: Send, drafts: Pencil,
  archive: Archive, spam: TriangleAlert, trash: Trash2, custom: Tag,
} as const;

function when(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const preview = (body: string) => body.replace(/\s+/g, " ").trim().slice(0, 140);

const fileSize = (n: number) =>
  n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/* ------------------------------------------------------------ one message */

function MessageCard({ m, expanded, onToggle }: { m: MailMessage; expanded: boolean; onToggle: () => void }) {
  return (
    <article className="overflow-hidden rounded-xl border border-line bg-white">
      <button
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left hover:bg-page/60"
        aria-expanded={expanded}
      >
        <Avatar name={m.from.name} size={36} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">{m.from.name}</span>
            <span className="truncate text-xs text-faint">{m.from.email}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            to {m.to.map((t) => t.name).join(", ") || "—"}
            {m.cc?.length ? ` · cc ${m.cc.map((c) => c.name).join(", ")}` : ""}
          </span>
          {!expanded && <span className="mt-1 block truncate text-sm text-muted">{preview(m.body)}</span>}
        </span>
        <span className="shrink-0 text-xs whitespace-nowrap text-faint">{when(m.date)}</span>
      </button>

      {expanded && (
        <div className="border-t border-line px-4 py-4">
          <p className="font-serif text-[15px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
          {(m.attachments?.length ?? 0) > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              {m.attachments!.map((a) => (
                <span key={a.name} className="flex items-center gap-2 rounded-lg border border-line bg-page px-3 py-2 text-xs">
                  <Paperclip size={13} className="text-muted" />
                  <span className="font-medium">{a.name}</span>
                  <span className="text-faint">{fileSize(a.size)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* -------------------------------------------------------------- the page */

export default function Mail() {
  const [params, setParams] = useSearchParams();
  const folderId = params.get("f") ?? "inbox";
  const openThreadId = params.get("t");
  const [accountId, setAccountId] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [compose, setCompose] = useState<ComposeSeed | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [tick, setTick] = useState(0);
  const [railOpen, setRailOpen] = useState(false);
  const { push } = useToast();

  // The store is a plain array; re-read it whenever anything writes.
  useEffect(() => onStoreChange(() => setTick((t) => t + 1)), []);
  useEffect(() => onMailChange(() => setTick((t) => t + 1)), []);

  /* Pull the mailbox down once. Threading needs the whole account rather than
     one folder, so this doesn't re-run when the folder changes. */
  useEffect(() => {
    void loadAccounts();
    void loadMailbox(accountId);
  }, [accountId]);

  const folder = mailFolders.find((f) => f.id === folderId) ?? mailFolders[0];
  const threads = useMemo(
    () => (query.trim() ? searchThreads(query, accountId) : threadsIn(folderId, accountId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folderId, accountId, query, tick]
  );
  const thread = threads.find((t) => t.threadId === openThreadId) ?? null;

  /* Opening a conversation marks it read, the way a mail client does. */
  useEffect(() => {
    if (!thread) return;
    const unread = thread.messages.filter((m) => !m.read).map((m) => m.id);
    if (unread.length) markRead(unread, true);
    setExpanded(new Set([thread.messages[thread.messages.length - 1].id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openThreadId]);

  const openThread = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("t", id);
    setParams(next);
  };
  const closeThread = () => {
    const next = new URLSearchParams(params);
    next.delete("t");
    setParams(next);
  };
  const goFolder = (id: string) => {
    setParams({ f: id });
    setSelected(new Set());
    setQuery("");
    setRailOpen(false);
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const selectedMessageIds = () =>
    threads.filter((t) => selected.has(t.threadId)).flatMap((t) => t.messages.map((m) => m.id));

  const act = (fn: () => void, label: string) => {
    fn();
    setSelected(new Set());
    push(label);
  };

  const sync = async () => {
    setSyncing(true);
    // Fetching is a background job on the server, so ask every account we're
    // showing to fetch, give the worker a moment, then re-read the mailbox.
    const targets =
      accountId === "all" ? mailAccounts.map((a) => a.id) : [accountId].filter(Boolean);
    const queued = await Promise.all(targets.map((id) => syncAccount(id)));
    await new Promise((r) => setTimeout(r, 1200));
    const ok = await loadMailbox(accountId);
    setSyncing(false);

    if (!ok) return push("Couldn't reach the mail server");
    push(queued.some(Boolean) ? "Mailbox refreshed" : "Refreshed — no account is connected yet");
  };

  const replySeed = (all: boolean): ComposeSeed | null => {
    if (!thread) return null;
    const last = thread.messages[thread.messages.length - 1];
    const account = mailAccounts.find((a) => a.id === last.accountId) ?? mailAccounts[0];
    const others = all
      ? [...last.to, ...(last.cc ?? [])].filter((a) => a.email !== account.email)
      : [];
    return {
      accountId: account.id,
      to: [last.from, ...others].map((a) => a.email).join(", "),
      subject: /^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`,
      body: `\n\n— — —\nOn ${when(last.date)}, ${last.from.name} wrote:\n${last.body
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n")}`,
      threadId: last.threadId,
    };
  };

  /* --------------------------------------------------------------- rail */

  const rail = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/50 p-3">
        <button className="btn-primary w-full justify-center py-2.5" onClick={() => setCompose({ accountId: mailAccounts[0]?.id ?? "" })}>
          <Pencil size={15} /> Compose
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {mailFolders.filter((f) => f.kind !== "custom").map((f) => {
          const Icon = FOLDER_ICON[f.kind];
          const n = f.kind === "sent" || f.kind === "drafts" ? 0 : unreadIn(f.id, accountId);
          return (
            <button
              key={f.id}
              onClick={() => goFolder(f.id)}
              aria-current={f.id === folderId ? "page" : undefined}
              className={clsx(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm",
                f.id === folderId ? "bg-primary text-white" : "text-muted hover:bg-white/60 hover:text-ink"
              )}
            >
              <Icon size={15} />
              <span className="flex-1">{f.name}</span>
              {n > 0 && (
                <span className={clsx("rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums", f.id === folderId ? "bg-white/25" : "bg-primary-soft text-primary")}>
                  {n}
                </span>
              )}
            </button>
          );
        })}

        <p className="px-3 pt-4 pb-1.5 text-[11px] font-bold tracking-wider text-faint uppercase">Labels</p>
        {mailFolders.filter((f) => f.kind === "custom").map((f) => (
          <button
            key={f.id}
            onClick={() => goFolder(f.id)}
            aria-current={f.id === folderId ? "page" : undefined}
            className={clsx(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm",
              f.id === folderId ? "bg-primary text-white" : "text-muted hover:bg-white/60 hover:text-ink"
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.color }} />
            <span className="flex-1">{f.name}</span>
          </button>
        ))}
      </nav>

      <div className="border-t border-white/50 p-3">
        <label className="lbl">Account</label>
        <select className="input w-full py-1.5 text-[13px]" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="all">All accounts</option>
          {mailAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.email}</option>
          ))}
        </select>
        <Link to="/mail/accounts" className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-muted hover:text-primary">
          <Settings2 size={14} /> Mail accounts
        </Link>
      </div>
    </div>
  );

  /* -------------------------------------------------------------- render */

  return (
    <div className="-m-4 flex h-[calc(100%+32px)] md:-m-6 md:h-[calc(100%+48px)]">
      {/* folder rail — a drawer under lg */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/50 bg-white/35 backdrop-blur-xl lg:flex">
        {rail}
      </aside>
      {railOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" onClick={() => setRailOpen(false)}>
          <div className="w-64 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>{rail}</div>
        </div>
      )}

      {/* conversation list */}
      <section
        className={clsx(
          "flex min-w-0 flex-col border-r border-white/50 bg-white/25",
          thread ? "hidden xl:flex xl:w-[26rem] xl:shrink-0" : "flex-1"
        )}
      >
        <header className="flex items-center gap-2 border-b border-white/50 px-3 py-3">
          <button className="btn-ghost cursor-pointer px-2 py-2 lg:hidden" onClick={() => setRailOpen(true)} aria-label="Folders">
            <MailIcon size={16} />
          </button>
          <div className="relative min-w-0 flex-1">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${folder.name.toLowerCase()}…`}
              className="input w-full py-1.5 pl-8 text-[13px]"
            />
            {query && (
              <button className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-faint hover:text-ink" onClick={() => setQuery("")} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
          <button className="btn-ghost cursor-pointer px-2 py-2" onClick={sync} disabled={syncing} aria-label="Sync mailbox">
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
          </button>
        </header>

        {/* bulk actions appear only with a selection */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-white/50 bg-primary-soft px-3 py-2">
            <span className="mr-1 text-xs font-semibold text-primary">{selected.size} selected</span>
            <button className="btn-ghost cursor-pointer px-2 py-1 text-xs" onClick={() => act(() => markRead(selectedMessageIds(), true), "Marked as read")}>
              <MailOpen size={13} /> Read
            </button>
            <button className="btn-ghost cursor-pointer px-2 py-1 text-xs" onClick={() => act(() => markRead(selectedMessageIds(), false), "Marked as unread")}>
              <MailIcon size={13} /> Unread
            </button>
            <button className="btn-ghost cursor-pointer px-2 py-1 text-xs" onClick={() => act(() => moveTo(selectedMessageIds(), "archive"), "Archived")}>
              <Archive size={13} /> Archive
            </button>
            <button className="btn-ghost cursor-pointer px-2 py-1 text-xs text-bad" onClick={() => act(() => deleteMessages(selectedMessageIds()), folder.kind === "trash" ? "Deleted for good" : "Moved to Trash")}>
              <Trash2 size={13} /> Delete
            </button>
            <button className="btn-ghost ml-auto cursor-pointer px-2 py-1 text-xs" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <EmptyState
              text={
                query
                  ? `Nothing matches “${query}”`
                  : folder.kind === "inbox"
                    ? "Inbox zero — nothing waiting"
                    : `No mail in ${folder.name}`
              }
            />
          ) : (
            <ul>
              {threads.map((t) => (
                <ThreadRow
                  key={t.threadId}
                  t={t}
                  active={t.threadId === openThreadId}
                  checked={selected.has(t.threadId)}
                  onCheck={() => toggleSelect(t.threadId)}
                  onOpen={() => openThread(t.threadId)}
                  onStar={() => toggleStar(t.latest.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* reading pane */}
      <section className={clsx("min-w-0 flex-1 flex-col overflow-y-auto bg-page/40", thread ? "flex" : "hidden xl:flex")}>
        {!thread ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
            <MailIcon size={30} className="text-faint" />
            <p className="text-sm font-medium text-muted">Pick a conversation to read it</p>
            <p className="max-w-xs text-xs text-faint">
              {threads.length} {threads.length === 1 ? "conversation" : "conversations"} in {folder.name}
            </p>
          </div>
        ) : (
          <>
            <header className="sticky top-0 z-10 border-b border-line bg-white/85 px-4 py-3 backdrop-blur-xl">
              <div className="flex items-start gap-2">
                <button className="btn-ghost cursor-pointer px-2 py-2 xl:hidden" onClick={closeThread} aria-label="Back to list">
                  <ChevronLeft size={16} />
                </button>
                <div className="min-w-0 flex-1">
                  <h1 className="font-display truncate text-lg font-bold">{thread.subject}</h1>
                  <p className="mt-0.5 text-xs text-muted">
                    {thread.messages.length} {thread.messages.length === 1 ? "message" : "messages"} · {thread.participants.join(", ")}
                  </p>
                </div>
                <button className="btn-ghost cursor-pointer px-2 py-2" onClick={() => toggleStar(thread.latest.id)} aria-label={thread.starred ? "Unstar" : "Star"}>
                  <Star size={16} className={thread.starred ? "fill-[#e8983c] text-[#e8983c]" : "text-muted"} />
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <button className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => setCompose(replySeed(false))}>
                  <Reply size={13} /> Reply
                </button>
                <button className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => setCompose(replySeed(true))}>
                  <ReplyAll size={13} /> Reply all
                </button>
                <button
                  className="btn-outline px-2.5 py-1.5 text-xs"
                  onClick={() => {
                    moveTo(thread.messages.map((m) => m.id), "archive");
                    closeThread();
                    push("Conversation archived");
                  }}
                >
                  <Archive size={13} /> Archive
                </button>
                <button
                  className="btn-outline px-2.5 py-1.5 text-xs text-bad"
                  onClick={() => {
                    deleteMessages(thread.messages.map((m) => m.id));
                    closeThread();
                    push(folder.kind === "trash" ? "Deleted for good" : "Moved to Trash");
                  }}
                >
                  <Trash2 size={13} /> Delete
                </button>

                <span className="ml-auto flex flex-wrap items-center gap-1">
                  {mailFolders.filter((f) => f.kind === "custom").map((f) => {
                    const on = thread.latest.labels?.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => applyLabel(thread.latest.id, f.id, !on)}
                        className={clsx(
                          "flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium",
                          on ? "border-transparent text-white" : "border-line bg-white text-muted hover:border-primary"
                        )}
                        style={on ? { background: f.color } : undefined}
                      >
                        <Tag size={11} /> {f.name}
                      </button>
                    );
                  })}
                </span>
              </div>
            </header>

            <div className="flex flex-col gap-3 p-4">
              {thread.messages.map((m) => (
                <MessageCard
                  key={m.id}
                  m={m}
                  expanded={expanded.has(m.id)}
                  onToggle={() =>
                    setExpanded((s) => {
                      const n = new Set(s);
                      n.has(m.id) ? n.delete(m.id) : n.add(m.id);
                      return n;
                    })
                  }
                />
              ))}
            </div>
          </>
        )}
      </section>

      {compose && <Compose seed={compose} onClose={() => setCompose(null)} />}
    </div>
  );
}

/* --------------------------------------------------------------- one row */

function ThreadRow({
  t, active, checked, onCheck, onOpen, onStar,
}: {
  t: MailThread;
  active: boolean;
  checked: boolean;
  onCheck: () => void;
  onOpen: () => void;
  onStar: () => void;
}) {
  const unread = t.unread > 0;
  return (
    <li
      className={clsx(
        "flex cursor-pointer items-start gap-2.5 border-b border-line/70 px-3 py-2.5",
        active ? "bg-primary-soft" : unread ? "bg-white/70 hover:bg-white" : "hover:bg-white/60"
      )}
      onClick={onOpen}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onCheck}
        onClick={(e) => e.stopPropagation()}
        className="mt-1.5 accent-primary"
        aria-label={`Select ${t.subject}`}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onStar(); }}
        className="mt-1 cursor-pointer"
        aria-label={t.starred ? "Unstar conversation" : "Star conversation"}
      >
        <Star size={14} className={t.starred ? "fill-[#e8983c] text-[#e8983c]" : "text-faint hover:text-muted"} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={clsx("truncate text-[13px]", unread ? "font-bold" : "font-medium text-muted")}>
            {t.participants.join(", ")}
          </span>
          {t.messages.length > 1 && (
            <span className="shrink-0 text-[11px] text-faint tabular-nums">{t.messages.length}</span>
          )}
          <span className="ml-auto shrink-0 text-[11px] whitespace-nowrap text-faint">{when(t.latest.date)}</span>
        </div>
        <p className={clsx("truncate text-[13px]", unread ? "font-semibold" : "text-muted")}>
          {t.latest.draft && <span className="mr-1 font-semibold text-bad">Draft</span>}
          {t.subject}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-faint">
          {t.hasAttachments && <Paperclip size={11} className="shrink-0" />}
          <span className="min-w-0 truncate">{preview(t.latest.body)}</span>
        </p>
      </div>
    </li>
  );
}
