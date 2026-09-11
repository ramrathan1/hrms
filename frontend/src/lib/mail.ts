/* Mail engine.
 *
 * Every mailbox operation the UI performs goes through here. IMAP and SMTP are
 * raw TCP protocols and a browser cannot open a socket, so the actual talking
 * happens in the API's mail worker — this file is the client for it.
 *
 * Threading and search stay local, over the messages `loadMailbox()` has
 * pulled down. That keeps the list instant while typing, and the server is
 * still the source of truth: flags, moves, deletes and sends are all requests,
 * applied optimistically here and reconciled from the response.
 */
import {
  mailAccounts, mailContacts, mailFolders, mailMessages,
  type MailAccount, type MailContact, type MailMessage,
} from "@/data/mail";
import { request } from "@/lib/http";

/** Mail is delivered by a real SMTP/IMAP worker now, not simulated. */
export const MAIL_IS_SIMULATED = false;

/* ---------------------------------------------------------- change bus */

/* The mailbox is a plain array, so anything that mutates it has to say so.
   Screens subscribe once and re-read. */
const mailListeners = new Set<() => void>();

export const onMailChange = (fn: () => void) => {
  mailListeners.add(fn);
  return () => {
    mailListeners.delete(fn);
  };
};

const mailChanged = () => mailListeners.forEach((fn) => fn());

/* --------------------------------------------------------------- folders */

/** The UI's folder ids and the API's `MailFolder` enum. */
const FOLDER_TO_API: Record<string, string> = {
  inbox: "INBOX",
  sent: "SENT",
  drafts: "DRAFTS",
  archive: "ARCHIVE",
  spam: "SPAM",
  trash: "TRASH",
};
const FOLDER_FROM_API: Record<string, string> = Object.fromEntries(
  Object.entries(FOLDER_TO_API).map(([ui, api]) => [api, ui])
);

const toApiFolder = (id: string) => FOLDER_TO_API[id] ?? "INBOX";

type ServerMessage = Record<string, any>;

/** Server message → the shape the mailbox components read. */
function fromServer(m: ServerMessage): MailMessage {
  return {
    id: String(m.id),
    accountId: String(m.accountId),
    folderId: FOLDER_FROM_API[String(m.folder)] ?? "inbox",
    threadId: String(m.threadKey ?? m.id),
    subject: String(m.subject ?? ""),
    from: { name: String(m.fromName ?? ""), email: String(m.fromEmail ?? "") },
    to: (m.toJson ?? []) as MailMessage["to"],
    cc: (m.ccJson ?? undefined) as MailMessage["cc"],
    body: String(m.body ?? ""),
    date: String(m.sentAt ?? m.createdAt ?? new Date().toISOString()),
    read: Boolean(m.isRead),
    starred: Boolean(m.isStarred),
    labels: (m.labels ?? []) as string[],
    ...(m.isDraft ? { draft: true } : {}),
  } as MailMessage;
}

const replaceLocal = (message: MailMessage) => {
  const at = mailMessages.findIndex((m) => m.id === message.id);
  if (at >= 0) mailMessages[at] = message;
  else mailMessages.unshift(message);
  mailChanged();
};

/**
 * Pull a mailbox down so threading and search have something to work on.
 *
 * Everything the account holds is fetched in one page rather than per folder —
 * a conversation can span Inbox and Sent, and threading it from two separate
 * requests would show half of it.
 */
export async function loadMailbox(accountId?: string, maxMessages = 600): Promise<boolean> {
  // The API caps a page at 200, so a full mailbox takes several requests.
  const PAGE = 200;
  const scope = accountId && accountId !== "all" ? { accountId } : {};
  const collected: ServerMessage[] = [];

  try {
    for (let page = 1; collected.length < maxMessages; page += 1) {
      const body = await request<{ data?: ServerMessage[]; meta?: { pages?: number } } | ServerMessage[]>(
        "/mail/messages",
        { query: { limit: PAGE, page, ...scope }, quiet: true }
      );

      if (Array.isArray(body)) {
        collected.push(...body);
        break;
      }
      collected.push(...(body?.data ?? []));
      if (page >= (body?.meta?.pages ?? 1)) break;
    }

    mailMessages.splice(0, mailMessages.length, ...collected.map(fromServer));
    rebuildContacts();
    mailChanged();
    return true;
  } catch {
    return false;
  }
}

/**
 * The address book, derived from the mailbox rather than stored.
 *
 * Everyone you have corresponded with is a contact; keeping a separate list
 * would immediately drift from the mail it is supposed to describe.
 */
function rebuildContacts(): void {
  const seen = new Map<string, MailContact>();
  const ours = new Set(mailAccounts.map((a) => a.email.toLowerCase()));

  const add = (name: string | undefined, email: string | undefined) => {
    const key = email?.trim().toLowerCase();
    if (!key || ours.has(key)) return;
    // First sighting wins, unless a later one carries a real name.
    const held = seen.get(key);
    if (held && (held.name !== held.email || !name)) return;
    seen.set(key, { id: key, name: name?.trim() || key, email: key, company: "" });
  };

  for (const m of mailMessages) {
    add(m.from?.name, m.from?.email);
    for (const to of m.to ?? []) add(to.name, to.email);
    for (const cc of m.cc ?? []) add(cc.name, cc.email);
  }

  mailContacts.splice(
    0,
    mailContacts.length,
    ...[...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  );
}

/** The connected accounts, refreshed from the server. */
export async function loadAccounts(): Promise<boolean> {
  try {
    const rows = await request<ServerMessage[]>("/mail/accounts", { quiet: true });
    mailAccounts.splice(
      0,
      mailAccounts.length,
      ...(rows ?? []).map(
        (a) =>
          ({
            id: String(a.id),
            name: String(a.displayName ?? a.email),
            email: String(a.email),
            provider: a.provider ?? "custom",
            imapHost: a.imapHost ?? "",
            imapPort: a.imapPort ?? 993,
            imapSecurity: a.imapSecurity ?? "SSL/TLS",
            smtpHost: a.smtpHost ?? "",
            smtpPort: a.smtpPort ?? 465,
            smtpSecurity: a.smtpSecurity ?? "SSL/TLS",
            username: a.username ?? a.email,
            default: Boolean(a.isDefault),
            status: a.status ?? "Connected",
            lastSyncAt: a.lastSyncAt ?? null,
          }) as unknown as MailAccount
      )
    );
    mailChanged();
    return true;
  } catch {
    return false;
  }
}

/** Ask the server to fetch new mail for one account. Returns when queued. */
export async function syncAccount(accountId: string): Promise<boolean> {
  try {
    await request(`/mail/accounts/${accountId}/sync`, { method: "POST", quiet: true });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------- threading */

export type MailThread = {
  threadId: string;
  subject: string;
  messages: MailMessage[];
  latest: MailMessage;
  unread: number;
  starred: boolean;
  hasAttachments: boolean;
  participants: string[];
};

const byNewest = (a: MailMessage, b: MailMessage) => b.date.localeCompare(a.date);

/** Group a folder's messages into conversations, newest activity first. */
export function threadsIn(folderId: string, accountId: string | "all"): MailThread[] {
  const scope = mailMessages.filter(
    (m) => m.accountId === accountId || accountId === "all"
  );

  const inFolder =
    folderId === "starred"
      ? scope.filter((m) => m.starred && m.folderId !== "trash")
      : mailFolders.find((f) => f.id === folderId)?.kind === "custom"
        ? scope.filter((m) => m.labels?.includes(folderId) && m.folderId !== "trash")
        : scope.filter((m) => m.folderId === folderId);

  const groups = new Map<string, MailMessage[]>();
  for (const m of inFolder) {
    const list = groups.get(m.threadId) ?? [];
    list.push(m);
    groups.set(m.threadId, list);
  }

  return [...groups.values()]
    .map((messages) => {
      const sorted = [...messages].sort(byNewest);
      const latest = sorted[0];
      return {
        threadId: latest.threadId,
        subject: latest.subject.replace(/^(re|fwd):\s*/i, "") || "(no subject)",
        messages: [...sorted].reverse(), // oldest first when reading
        latest,
        unread: sorted.filter((m) => !m.read).length,
        starred: sorted.some((m) => m.starred),
        hasAttachments: sorted.some((m) => (m.attachments?.length ?? 0) > 0),
        participants: [...new Set(sorted.map((m) => m.from.name))],
      };
    })
    .sort((a, b) => b.latest.date.localeCompare(a.latest.date));
}

export const unreadIn = (folderId: string, accountId: string | "all") =>
  threadsIn(folderId, accountId).reduce((a, t) => a + t.unread, 0);

/** Free-text across subject, participants and body. */
export function searchThreads(query: string, accountId: string | "all"): MailThread[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const hits = mailMessages.filter(
    (m) =>
      (accountId === "all" || m.accountId === accountId) &&
      m.folderId !== "trash" &&
      `${m.subject} ${m.from.name} ${m.from.email} ${m.to.map((t) => t.email).join(" ")} ${m.body}`
        .toLowerCase()
        .includes(q)
  );
  const ids = new Set(hits.map((m) => m.threadId));
  const groups = new Map<string, MailMessage[]>();
  for (const m of mailMessages.filter((x) => ids.has(x.threadId))) {
    const list = groups.get(m.threadId) ?? [];
    list.push(m);
    groups.set(m.threadId, list);
  }
  return [...groups.values()]
    .map((messages) => {
      const sorted = [...messages].sort(byNewest);
      const latest = sorted[0];
      return {
        threadId: latest.threadId,
        subject: latest.subject.replace(/^(re|fwd):\s*/i, "") || "(no subject)",
        messages: [...sorted].reverse(),
        latest,
        unread: sorted.filter((m) => !m.read).length,
        starred: sorted.some((m) => m.starred),
        hasAttachments: sorted.some((m) => (m.attachments?.length ?? 0) > 0),
        participants: [...new Set(sorted.map((m) => m.from.name))],
      };
    })
    .sort((a, b) => b.latest.date.localeCompare(a.latest.date));
}

/* ------------------------------------------------------------- mutations */

/**
 * Apply a change locally first, then send it.
 *
 * Marking a thread read has to feel instant — waiting a round trip to grey out
 * a row is the difference between a mail client and a web page. If the request
 * fails, the local edit is undone so the list doesn't keep claiming something
 * the server never accepted.
 */
function optimistic(ids: string[], patch: Partial<MailMessage>, send: () => Promise<unknown>) {
  const before = new Map<string, MailMessage>();
  for (const id of ids) {
    const at = mailMessages.findIndex((m) => m.id === id);
    if (at < 0) continue;
    before.set(id, mailMessages[at]);
    mailMessages[at] = { ...mailMessages[at], ...patch };
  }
  mailChanged();

  void send().catch(() => {
    for (const [id, row] of before) {
      const at = mailMessages.findIndex((m) => m.id === id);
      if (at >= 0) mailMessages[at] = row;
    }
    mailChanged();
  });
}

export const markRead = (ids: string[], read = true) => {
  if (!ids.length) return;
  optimistic(ids, { read }, () =>
    request("/mail/flags", { method: "PATCH", body: { messageIds: ids, isRead: read } })
  );
};

export const toggleStar = (id: string) => {
  const m = mailMessages.find((x) => x.id === id);
  if (!m) return;
  const starred = !m.starred;
  optimistic([id], { starred }, () =>
    request("/mail/flags", { method: "PATCH", body: { messageIds: [id], isStarred: starred } })
  );
};

export const moveTo = (ids: string[], folderId: string) => {
  if (!ids.length) return;
  optimistic(ids, { folderId } as Partial<MailMessage>, () =>
    request("/mail/move", {
      method: "PATCH",
      body: { messageIds: ids, folder: toApiFolder(folderId) },
    })
  );
};

export const applyLabel = (id: string, labelId: string, on: boolean) => {
  const m = mailMessages.find((x) => x.id === id);
  if (!m) return;
  const labels = new Set(m.labels ?? []);
  if (on) labels.add(labelId);
  else labels.delete(labelId);
  const next = [...labels];
  optimistic([id], { labels: next } as Partial<MailMessage>, () =>
    request("/mail/flags", { method: "PATCH", body: { messageIds: [id], labels: next } })
  );
};

/**
 * Trash first, then delete for good on a second pass — the server applies the
 * same rule, so one call covers both.
 */
export const deleteMessages = (ids: string[]) => {
  if (!ids.length) return;

  const gone = new Map<string, { row: MailMessage; at: number }>();
  for (const id of ids) {
    const at = mailMessages.findIndex((m) => m.id === id);
    if (at < 0) continue;
    const row = mailMessages[at];
    if (row.folderId === "trash") {
      gone.set(id, { row, at });
      mailMessages.splice(at, 1);
    } else {
      mailMessages[at] = { ...row, folderId: "trash" } as MailMessage;
    }
  }

  mailChanged();

  void request("/mail/messages", { method: "DELETE", body: { messageIds: ids } }).catch(() => {
    // Put back anything we removed on the assumption the server would agree.
    for (const { row, at } of gone.values()) {
      mailMessages.splice(Math.min(at, mailMessages.length), 0, row);
    }
    mailChanged();
  });
};

export const defaultAccount = () => mailAccounts.find((a) => a.default) ?? mailAccounts[0];

/* --------------------------------------------------------------- sending */

export type Draft = {
  id?: string;
  accountId: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  /** Set when this is a reply, so it stays in the same conversation. */
  threadId?: string;
};

const parseAddresses = (raw: string) =>
  raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.*?)\s*<(.+?)>$/);
      return m ? { name: m[1].trim() || m[2], email: m[2] } : { name: s, email: s };
    });

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

/** Everything wrong with a draft, so the composer can block send and say why. */
export function validateDraft(d: Draft): string[] {
  const problems: string[] = [];
  const to = parseAddresses(d.to);
  if (!to.length) problems.push("Add at least one recipient");
  const badTo = to.filter((a) => !isEmail(a.email)).map((a) => a.email);
  if (badTo.length) problems.push(`Not a valid address: ${badTo.join(", ")}`);
  const badCc = parseAddresses(d.cc ?? "").filter((a) => !isEmail(a.email)).map((a) => a.email);
  if (badCc.length) problems.push(`Not a valid Cc address: ${badCc.join(", ")}`);
  if (!d.subject.trim() && !d.body.trim()) problems.push("Add a subject or a message");
  return problems;
}

/**
 * Hand a draft to the server for delivery.
 *
 * The API writes it to Sent and queues it for SMTP, so this resolves as soon as
 * the message is safely stored — not when the recipient's server accepts it. If
 * delivery ultimately fails the worker returns the message to Drafts.
 */
export async function sendDraft(d: Draft): Promise<MailMessage> {
  const problems = validateDraft(d);
  if (problems.length) throw new Error(problems[0]);

  const sent = await request<ServerMessage>("/mail/send", {
    method: "POST",
    body: {
      accountId: d.accountId || undefined,
      to: d.to,
      cc: d.cc || undefined,
      subject: d.subject.trim() || "(no subject)",
      body: d.body,
      threadKey: d.threadId || undefined,
      draftId: d.id || undefined,
    },
    quiet: true,
  });

  const message = fromServer(sent);
  // The draft became the sent copy; drop the version the list still holds.
  if (d.id && d.id !== message.id) {
    const at = mailMessages.findIndex((m) => m.id === d.id);
    if (at >= 0) mailMessages.splice(at, 1);
  }
  replaceLocal(message);
  return message;
}

/** Save without sending. Drafts are never queued. */
export async function saveDraft(d: Draft): Promise<MailMessage> {
  const saved = await request<ServerMessage>("/mail/drafts", {
    method: "POST",
    body: {
      accountId: d.accountId || undefined,
      to: d.to,
      cc: d.cc || undefined,
      subject: d.subject.trim(),
      body: d.body,
      threadKey: d.threadId || undefined,
      draftId: d.id || undefined,
    },
    quiet: true,
  });

  const message = fromServer(saved);
  if (d.id && d.id !== message.id) {
    const at = mailMessages.findIndex((m) => m.id === d.id);
    if (at >= 0) mailMessages.splice(at, 1);
  }
  replaceLocal(message);
  return message;
}

/* ----------------------------------------------------------- connections */

export type ConnectionResult = { ok: boolean; steps: { label: string; ok: boolean; detail: string }[] };

/**
 * Test an account's settings against the real servers.
 *
 * The obvious shape problems are caught here so an incomplete form doesn't cost
 * a round trip; everything past that is a genuine IMAP and SMTP handshake
 * performed by the API, and the steps it reports are what actually happened.
 */
export async function testConnection(a: Partial<MailAccount> & { password?: string }): Promise<ConnectionResult> {
  const steps: ConnectionResult["steps"] = [];

  const emailOk = isEmail(String(a.email ?? ""));
  steps.push({
    label: "Email address",
    ok: emailOk,
    detail: emailOk ? String(a.email) : "Not a valid address",
  });

  const imapOk = Boolean(a.imapHost?.trim()) && Number(a.imapPort) > 0;
  steps.push({
    label: "IMAP server",
    ok: imapOk,
    detail: imapOk ? `${a.imapHost}:${a.imapPort}` : "Host and port are required",
  });

  const smtpOk = Boolean(a.smtpHost?.trim()) && Number(a.smtpPort) > 0;
  steps.push({
    label: "SMTP server",
    ok: smtpOk,
    detail: smtpOk ? `${a.smtpHost}:${a.smtpPort}` : "Host and port are required",
  });

  if (!emailOk || !imapOk || !smtpOk) {
    steps.push({ label: "Connection", ok: false, detail: "Skipped — fix the problems above" });
    return { ok: false, steps };
  }

  try {
    const result = await request<{
      ok: boolean;
      imap?: { ok: boolean; detail?: string };
      smtp?: { ok: boolean; detail?: string };
      message?: string;
    }>("/mail/accounts/test", {
      method: "POST",
      body: {
        email: a.email,
        imapHost: a.imapHost,
        imapPort: Number(a.imapPort),
        smtpHost: a.smtpHost,
        smtpPort: Number(a.smtpPort),
        username: a.username ?? a.email,
        password: a.password,
      },
      quiet: true,
    });

    steps.push({
      label: "IMAP sign-in",
      ok: result.imap?.ok ?? result.ok,
      detail: result.imap?.detail ?? (result.ok ? "Connected" : "Refused"),
    });
    steps.push({
      label: "SMTP sign-in",
      ok: result.smtp?.ok ?? result.ok,
      detail: result.smtp?.detail ?? (result.ok ? "Connected" : "Refused"),
    });
    return { ok: result.ok, steps };
  } catch (err) {
    steps.push({
      label: "Connection",
      ok: false,
      detail: err instanceof Error ? err.message : "The server could not be reached",
    });
    return { ok: false, steps };
  }
}
