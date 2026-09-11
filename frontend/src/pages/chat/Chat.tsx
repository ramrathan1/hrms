/* Slack-style communication: channels, threads, reactions, live via WebSocket,
   and "create task from message" for instant assignment. */
import clsx from "clsx";
import {
  CheckSquare, Hash, Lock, MessageSquare, MoreHorizontal, PanelLeft, Plus, Search, Send, SmilePlus, Users, Video, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ConfirmDialog, FormModal } from "@/components/crud";
import { TaskQuickCreate } from "@/components/TaskQuickCreate";
import { Avatar, Dropdown, Modal } from "@/components/ui";
import { channelMessages as seedMessages, channels, type Channel, type ChannelMessage } from "@/data/collab";
import { employees } from "@/data/core";
import { api, loadMessages } from "@/lib/api";
import { CURRENT_USER, useToast } from "@/lib/store";
import { wsc } from "@/lib/ws";

const EMOJIS = ["👍", "✅", "🎉", "❤️", "👀", "🔥"];

/** highlight @First-name mentions inside message text */
function renderMentions(text: string) {
  const names = employees.map((e) => e.name.split(" ")[0]);
  const parts = text.split(/(@[A-Za-z]+)/g);
  return parts.map((p, i) =>
    p.startsWith("@") && names.includes(p.slice(1)) ? (
      <span key={i} className="rounded bg-primary-soft px-1 font-semibold text-primary">{p}</span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function MessageRow({
  m,
  onReact,
  onThread,
  onTask,
  inThread,
  replyCount,
}: {
  m: ChannelMessage;
  onReact: (emoji: string) => void;
  onThread?: () => void;
  onTask: () => void;
  inThread?: boolean;
  replyCount?: number;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="group relative flex gap-3 rounded-xl px-3 py-2 hover:bg-white/45">
      <Avatar name={m.name} size={inThread ? 30 : 36} />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="text-sm font-bold">{m.name}</span>
          <span className="text-[11px] text-faint">{timeLabel(m.time)}</span>
        </p>
        <p className="text-sm leading-relaxed break-words">{renderMentions(m.text)}</p>
        {(Object.keys(m.reactions ?? {}).length > 0 || (replyCount ?? 0) > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {Object.entries(m.reactions ?? {}).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="flex cursor-pointer items-center gap-1 rounded-full border border-primary/25 bg-primary-soft px-2 py-0.5 text-xs hover:border-primary"
              >
                {emoji} <span className="font-semibold text-primary tabular-nums">{count}</span>
              </button>
            ))}
            {(replyCount ?? 0) > 0 && (
              <button onClick={onThread} className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                {replyCount} repl{replyCount === 1 ? "y" : "ies"} →
              </button>
            )}
          </div>
        )}
      </div>
      {/* hover toolbar */}
      <div className="absolute -top-3 right-3 hidden items-center gap-0.5 rounded-lg border border-line bg-white p-0.5 shadow-md group-hover:flex">
        <button className="btn-ghost relative px-1.5 py-1" onClick={() => setPickerOpen((o) => !o)} aria-label="React">
          <SmilePlus size={14} />
        </button>
        {!inThread && onThread && (
          <button className="btn-ghost px-1.5 py-1" onClick={onThread} aria-label="Reply in thread">
            <MessageSquare size={14} />
          </button>
        )}
        <button className="btn-ghost px-1.5 py-1" onClick={onTask} aria-label="Create task from message">
          <CheckSquare size={14} />
        </button>
        {pickerOpen && (
          <div className="absolute top-8 right-0 z-20 flex gap-1 rounded-lg border border-line bg-white p-1.5 shadow-lg">
            {EMOJIS.map((e) => (
              <button
                key={e}
                className="cursor-pointer rounded px-1 text-lg hover:bg-page"
                onClick={() => {
                  onReact(e);
                  setPickerOpen(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const [params, setParams] = useSearchParams();
  const [chans, setChans] = useState<Channel[]>(() => [...channels]);
  // Channel ids come from the server, so there is no fixed default to fall back
  // on — open whichever channel is first until the user picks another.
  const activeId = params.get("c") ?? chans[0]?.id ?? "";
  const [messages, setMessages] = useState<ChannelMessage[]>(() => [...seedMessages]);
  const [draft, setDraft] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadDraft, setThreadDraft] = useState("");
  const [taskFrom, setTaskFrom] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [channelModal, setChannelModal] = useState<"create" | "rename" | null>(null);
  const [groupModal, setGroupModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const { push } = useToast();

  /* A brand-new workspace has no channels at all. Rather than guard every
     reference below, stand in an empty one and let the transcript area explain
     what to do. */
  const NO_CHANNEL: Channel = { id: "", name: "", desc: "" };
  const channel = chans.find((c) => c.id === activeId) ?? chans[0] ?? NO_CHANNEL;

  const commitChans = (next: Channel[]) => {
    setChans(next);
    channels.splice(0, channels.length, ...next);
  };

  const createChannel = (v: Record<string, unknown>) => {
    const id = String(v.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `ch-${Date.now()}`;
    const ch: Channel = { id, name: String(v.name), desc: String(v.desc ?? ""), private: v.visibility === "Private" };
    commitChans([...chans, ch]);
    void api.create("channels", ch);
    push(`#${ch.name} created`);
    setParams({ c: ch.id });
    setChannelModal(null);
  };

  const createGroup = () => {
    if (groupMembers.length < 2) return push("Pick at least 2 people for a group");
    const names = groupMembers.map((m) => employees.find((e) => e.id === m)?.name.split(" ")[0]).join(", ");
    const ch: Channel = { id: `grp-${Date.now().toString(36)}`, name: names, desc: "Group conversation", group: true, members: groupMembers };
    commitChans([...chans, ch]);
    void api.create("channels", ch);
    push(`Group created with ${groupMembers.length} people`);
    setParams({ c: ch.id });
    setGroupModal(false);
    setGroupMembers([]);
  };

  const memberAvatars = channel.group
    ? (channel.members ?? [])
    : employees.slice(0, 5).map((e) => e.id);

  useEffect(() => {
    const offs = [
      wsc.on("chat:new", ({ message }) =>
        setMessages((ms) => (ms.some((x) => x.id === message.id) ? ms : [...ms, message]))
      ),
      wsc.on("chat:update", ({ message }) =>
        setMessages((ms) => ms.map((x) => (x.id === message.id ? message : x)))
      ),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  /* Transcripts are fetched per channel rather than all at once — only the open
     one is worth the round trip. Joining the room is what makes the live
     messages arrive; without it the socket is connected but deaf to this
     channel. */
  useEffect(() => {
    if (!activeId || activeId.startsWith("dm-")) return;
    let live = true;
    wsc.send({ type: "chat:subscribe", channelId: activeId });
    void loadMessages(activeId).then((rows) => {
      if (!live) return;
      setMessages((ms) => {
        // Keep anything from other channels; replace this channel's history.
        const others = ms.filter((m) => m.channelId !== activeId);
        return [...others, ...(rows as ChannelMessage[])];
      });
    });
    return () => {
      live = false;
    };
  }, [activeId]);

  /* The store inserts newest-first; a transcript reads oldest-first. */
  const byTime = (a: ChannelMessage, b: ChannelMessage) => String(a.time).localeCompare(String(b.time));
  const channelMsgs = useMemo(
    () => messages.filter((m) => m.channelId === channel.id && !m.threadId).sort(byTime),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, channel.id]
  );
  const threadMsgs = useMemo(
    () => (threadId ? messages.filter((m) => m.threadId === threadId).sort(byTime) : []),
    [messages, threadId]
  );
  const threadRoot = threadId ? messages.find((m) => m.id === threadId) : null;
  const replyCount = (id: string) => messages.filter((m) => m.threadId === id).length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [channelMsgs.length, channel.id]);

  const send = (text: string, inThread?: string | null) => {
    const t = text.trim();
    if (!t) return;
    if (t.startsWith("/task ")) {
      setTaskFrom(t.slice(6));
      return;
    }
    wsc.send({ type: "chat:send", channelId: activeId, threadId: inThread ?? null, text: t });
    // notify anyone @mentioned
    const mentioned = employees.filter((e) => t.includes(`@${e.name.split(" ")[0]}`));
    if (mentioned.length) {
      wsc.send({ type: "notify", text: `mentioned ${mentioned.map((m) => m.name.split(" ")[0]).join(", ")} in #${channel.name}` });
      push(`${mentioned.length} person${mentioned.length === 1 ? "" : "s"} notified`);
    }
    setMentionQuery(null);
  };

  const react = (m: ChannelMessage, emoji: string) =>
    wsc.send({ type: "chat:react", messageId: m.id, emoji });

  return (
    <div className="-m-4 flex h-[calc(100%+32px)] flex-col md:-m-6 md:h-[calc(100%+48px)]">
      <div className="flex min-h-0 flex-1">
      {/* channel rail */}
      {railOpen && (
        <div className="fixed inset-0 z-40 bg-ink/40 md:hidden" onClick={() => setRailOpen(false)} aria-hidden />
      )}
      <aside
        className={clsx(
          "flex w-64 shrink-0 flex-col border-r border-white/50 bg-white/95 backdrop-blur-xl md:static md:translate-x-0 md:bg-white/35",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200",
          railOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="border-b border-white/50 px-4 py-4">
          <h1 className="font-display text-lg font-bold">Communication</h1>
          <div className="relative mt-2.5">
            <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Jump to…" className="input w-full py-1.5 pl-8 text-[13px]" />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <p className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-bold tracking-wider text-faint uppercase">
            Channels
            <button className="cursor-pointer rounded-md p-0.5 text-muted hover:bg-page hover:text-primary" onClick={() => setChannelModal("create")} aria-label="Create channel">
              <Plus size={14} />
            </button>
          </p>
          {chans
            .filter((c) => !c.group && c.name.includes(filter.toLowerCase()))
            .map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setParams({ c: c.id });
                  setThreadId(null);
                  setRailOpen(false);
                }}
                className={clsx(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm",
                  c.id === channel.id ? "bg-primary text-white" : "text-muted hover:bg-white/60 hover:text-ink"
                )}
              >
                {c.private ? <Lock size={13} /> : <Hash size={13} />}
                {c.name}
              </button>
            ))}
          <p className="flex items-center justify-between px-2 pt-4 pb-1.5 text-[11px] font-bold tracking-wider text-faint uppercase">
            Groups
            <button className="cursor-pointer rounded-md p-0.5 text-muted hover:bg-page hover:text-primary" onClick={() => setGroupModal(true)} aria-label="Create group">
              <Plus size={14} />
            </button>
          </p>
          {chans.filter((c) => c.group).length === 0 && (
            <p className="px-2.5 py-1 text-xs text-faint">No groups yet — press +</p>
          )}
          {chans
            .filter((c) => c.group && c.name.toLowerCase().includes(filter.toLowerCase()))
            .map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setParams({ c: c.id });
                  setThreadId(null);
                  setRailOpen(false);
                }}
                className={clsx(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm",
                  c.id === channel.id ? "bg-primary text-white" : "text-muted hover:bg-white/60 hover:text-ink"
                )}
              >
                <Users size={13} />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          <p className="px-2 pt-4 pb-1.5 text-[11px] font-bold tracking-wider text-faint uppercase">Direct messages</p>
          {employees
            .filter((e) => e.id !== CURRENT_USER.id && e.name.toLowerCase().includes(filter.toLowerCase()))
            .slice(0, 7)
            .map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  setParams({ c: `dm-${e.id}` });
                  setThreadId(null);
                }}
                className={clsx(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm",
                  activeId === `dm-${e.id}` ? "bg-primary text-white" : "text-muted hover:bg-white/60 hover:text-ink"
                )}
              >
                <Avatar name={e.name} size={20} /> {e.name.split(" ")[0]}
              </button>
            ))}
        </nav>
      </aside>

      {/* messages */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/50 bg-white/35 px-4 py-3 backdrop-blur-xl md:px-5">
          <button
            className="btn-ghost -ml-1 cursor-pointer px-2 py-2 md:hidden"
            onClick={() => setRailOpen(true)}
            aria-label="Channels"
          >
            <PanelLeft size={16} />
          </button>
          <h2 className="flex min-w-0 items-center gap-1.5 font-display text-[15px] font-bold">
            {activeId.startsWith("dm-") ? (
              <>@ {employees.find((e) => `dm-${e.id}` === activeId)?.name}</>
            ) : (
              <>
                {channel.group ? <Users size={15} /> : channel.private ? <Lock size={15} /> : <Hash size={15} />}{" "}
                <span className="max-w-56 truncate">{channel.name}</span>
              </>
            )}
          </h2>
          <span className="hidden max-w-64 truncate text-xs text-muted lg:block">{!activeId.startsWith("dm-") && channel.desc}</span>
          {!activeId.startsWith("dm-") && (
            <span className="ml-auto flex items-center gap-2">
              <span className="flex -space-x-1.5">
                {memberAvatars.slice(0, 4).map((id) => (
                  <Avatar key={id} name={employees.find((e) => e.id === id)?.name ?? id} size={24} />
                ))}
              </span>
              <span className="text-xs text-muted tabular-nums">{channel.group ? (channel.members?.length ?? 0) : employees.length}</span>
            </span>
          )}
          <button
            className={clsx("btn-outline gap-1.5 px-3 py-1.5 text-xs", activeId.startsWith("dm-") && "ml-auto")}
            onClick={() => nav(`/meet/huddle-${activeId}`)}
          >
            <Video size={13} /> Huddle
          </button>
          {!activeId.startsWith("dm-") && channel.id !== "general" && (
            <Dropdown
              button={
                <button className="btn-ghost px-1.5 py-1.5" aria-label="Channel options">
                  <MoreHorizontal size={15} />
                </button>
              }
              items={[
                { label: "Rename channel", onClick: () => setChannelModal("rename") },
                { label: channel.group ? "Delete group" : "Delete channel", danger: true, onClick: () => setDeleting(true) },
              ]}
            />
          )}
        </header>

        <div ref={scrollRef} className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {(activeId.startsWith("dm-")
            ? messages.filter((m) => m.channelId === activeId && !m.threadId)
            : channelMsgs
          ).map((m) => (
            <MessageRow
              key={m.id}
              m={m}
              onReact={(e) => react(m, e)}
              onThread={() => setThreadId(m.id)}
              onTask={() => setTaskFrom(m.text)}
              replyCount={replyCount(m.id)}
            />
          ))}
          {chans.length === 0 ? (
            <div className="py-16 text-center text-sm text-faint">
              <p>No channels yet.</p>
              <button
                className="mt-3 cursor-pointer font-medium text-primary hover:underline"
                onClick={() => setChannelModal("create")}
              >
                Create the first one
              </button>
            </div>
          ) : (
            channelMsgs.length === 0 &&
            !activeId.startsWith("dm-") && (
              <p className="py-16 text-center text-sm text-faint">
                This is the start of #{channel.name}
              </p>
            )
          )}
          {activeId.startsWith("dm-") &&
            messages.filter((m) => m.channelId === activeId).length === 0 && (
              <p className="py-16 text-center text-sm text-faint">
                Say hi to {employees.find((e) => `dm-${e.id}` === activeId)?.name?.split(" ")[0]} 👋
              </p>
            )}
        </div>

        <div className="relative px-4 pb-4">
          {/* @mention picker */}
          {mentionQuery !== null && (
            <div className="absolute bottom-[74px] left-4 z-20 w-64 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
              <p className="border-b border-line px-3 py-1.5 text-[11px] font-bold tracking-wider text-faint uppercase">Mention someone</p>
              {employees
                .filter((e) => e.name.toLowerCase().includes(mentionQuery.toLowerCase()))
                .slice(0, 6)
                .map((e) => (
                  <button
                    key={e.id}
                    className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-page"
                    onClick={() => {
                      setDraft((d) => d.replace(/@\w*$/, `@${e.name.split(" ")[0]} `));
                      setMentionQuery(null);
                    }}
                  >
                    <Avatar name={e.name} size={24} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{e.name}</span>
                      <span className="block truncate text-[11px] text-muted">{e.designation}</span>
                    </span>
                  </button>
                ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-white/60 bg-white/70 p-2 shadow-sm backdrop-blur-xl focus-within:border-primary">
            <textarea
              rows={1}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                const m = e.target.value.match(/@(\w*)$/);
                setMentionQuery(m ? m[1] : null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                  setDraft("");
                }
              }}
              placeholder={`Message ${activeId.startsWith("dm-") ? employees.find((e) => `dm-${e.id}` === activeId)?.name?.split(" ")[0] : "#" + channel.name}  ·  try "/task Fix the login bug"`}
              className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-faint"
            />
            <button
              className="btn-primary px-3 py-2"
              onClick={() => {
                send(draft);
                setDraft("");
              }}
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* thread panel */}
      {threadRoot && (
        <aside className="flex w-96 shrink-0 flex-col border-l border-white/50 bg-white/35 backdrop-blur-xl">
          <header className="flex items-center justify-between border-b border-white/50 px-4 py-3">
            <h3 className="font-display text-sm font-bold">Thread</h3>
            <button className="btn-ghost px-1.5 py-1" onClick={() => setThreadId(null)} aria-label="Close thread">
              <X size={15} />
            </button>
          </header>
          <div className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
            <MessageRow m={threadRoot} onReact={(e) => react(threadRoot, e)} onTask={() => setTaskFrom(threadRoot.text)} inThread />
            <div className="mx-3 my-2 border-t border-line" />
            {threadMsgs.map((m) => (
              <MessageRow key={m.id} m={m} onReact={(e) => react(m, e)} onTask={() => setTaskFrom(m.text)} inThread />
            ))}
          </div>
          <div className="p-3">
            <div className="flex items-end gap-2 rounded-xl border border-white/60 bg-white/70 p-1.5">
              <textarea
                rows={1}
                value={threadDraft}
                onChange={(e) => setThreadDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(threadDraft, threadId);
                    setThreadDraft("");
                  }
                }}
                placeholder="Reply…"
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
              />
              <button
                className="btn-primary px-2.5 py-1.5"
                onClick={() => {
                  send(threadDraft, threadId);
                  setThreadDraft("");
                }}
                aria-label="Send reply"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </aside>
      )}

      <TaskQuickCreate
        open={taskFrom !== null}
        onClose={() => setTaskFrom(null)}
        initialTitle={taskFrom ?? ""}
        source={`chat · ${activeId.startsWith("dm-") ? "DM" : "#" + channel.name}`}
      />

      {/* create / rename channel */}
      <FormModal
        open={channelModal !== null}
        title={channelModal === "rename" ? `Rename #${channel.name}` : "Create a channel"}
        fields={[
          { key: "name", label: "Channel name", required: true, placeholder: "e.g. marketing" },
          { key: "visibility", label: "Visibility", type: "select", options: ["Public", "Private"] },
          { key: "desc", label: "Description", type: "textarea", placeholder: "What is this channel about?" },
        ]}
        initial={channelModal === "rename" ? { name: channel.name, desc: channel.desc, visibility: channel.private ? "Private" : "Public" } : { visibility: "Public" }}
        submitLabel={channelModal === "rename" ? "Rename" : "Create Channel"}
        onSubmit={(v) => {
          if (channelModal === "rename") {
            commitChans(chans.map((c) => (c.id === channel.id ? { ...c, name: String(v.name), desc: String(v.desc ?? "") } : c)));
            void api.update("channels", channel.id, { name: v.name, desc: v.desc });
            push("Channel renamed");
            setChannelModal(null);
          } else {
            createChannel(v);
          }
        }}
        onClose={() => setChannelModal(null)}
      />

      {/* create group */}
      <Modal open={groupModal} onClose={() => setGroupModal(false)} title="New group conversation" wide>
        <p className="mb-3 text-sm text-muted">Pick the people for this group — everyone sees the same conversation.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {employees
            .filter((e) => e.id !== CURRENT_USER.id)
            .map((e) => (
              <label key={e.id} className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line bg-white/70 px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary-soft">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={groupMembers.includes(e.id)}
                  onChange={() =>
                    setGroupMembers((ms) => (ms.includes(e.id) ? ms.filter((m) => m !== e.id) : [...ms, e.id]))
                  }
                />
                <Avatar name={e.name} size={26} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{e.name}</span>
                  <span className="block truncate text-xs text-muted">{e.designation}</span>
                </span>
              </label>
            ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" onClick={createGroup}>
            <Users size={14} /> Create Group ({groupMembers.length})
          </button>
          <button className="btn-ghost" onClick={() => setGroupModal(false)}>Cancel</button>
        </div>
      </Modal>

      {/* delete channel */}
      <ConfirmDialog
        open={deleting}
        text={`This will delete ${channel.group ? "the group" : "#" + channel.name} and its messages for everyone.`}
        onConfirm={() => {
          commitChans(chans.filter((c) => c.id !== channel.id));
          void api.remove("channels", channel.id);
          push(`${channel.group ? "Group" : "#" + channel.name} deleted`);
          setDeleting(false);
          setParams({ c: "general" });
        }}
        onClose={() => setDeleting(false)}
      />
      </div>
    </div>
  );
}
