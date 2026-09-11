/**
 * The data layer.
 *
 * Pages import plain arrays from `@/data/*` and read them synchronously — that
 * hasn't changed. What changed is where the contents come from: `hydrate()`
 * signs in, pulls every collection the API serves, translates it through
 * `adapters.ts` and splices the result into those same arrays. A page never
 * learns whether a row arrived over HTTP.
 *
 * Writes are optimistic. `api.create/update/remove` mutate the array first so
 * the UI responds immediately, then send the request; if the server refuses,
 * the change is rolled back and the error surfaces as a toast. Anything the
 * caller does between those two moments sees the optimistic value, which is the
 * point.
 *
 * Some collections still have no endpoint (proposals, payslips, objectives and
 * a few more). Those keep working exactly as before, against browser storage —
 * see `LOCAL_ONLY` below for the full list.
 */
import * as core from "@/data/core";
import * as crm from "@/data/crm";
import * as work from "@/data/work";
import * as finance from "@/data/finance";
import * as hr from "@/data/hr";
import * as people2 from "@/data/people2";
import * as recruit from "@/data/recruit";
import * as ops from "@/data/ops";
import * as collab from "@/data/collab";
import * as mail from "@/data/mail";
import * as admin from "@/data/admin";

import { ADAPTERS, asEmployee, learnPeople, num, type Adapter } from "./adapters";
import {
  ApiError, apiErrors, announce, onSignedOut, request, tokens, type Paginated,
} from "./http";

export { apiErrors, onSignedOut, ApiError };

type Row = Record<string, any> & { id?: string | number };

const collections: Record<string, unknown[]> = {
  employees: core.employees, departments: core.departments, designations: core.designations,
  clients: core.clients, clientContacts: core.clientContacts,
  leads: crm.leads, pipelineStages: crm.pipelineStages, deals: crm.deals,
  leadForms: crm.leadForms, leadNotes: crm.leadNotes, leadEmails: crm.leadEmails,
  projects: work.projects, tasks: work.tasks, milestones: work.milestones,
  timeLogs: work.timeLogs, contracts: work.contracts, roadmapIdeas: work.roadmapIdeas,
  discussions: work.discussions, projectFiles: work.projectFiles,
  invoices: finance.invoices, estimates: finance.estimates, proposals: finance.proposals,
  payments: finance.payments, creditNotes: finance.creditNotes, expenses: finance.expenses,
  recurringExpenses: finance.recurringExpenses,
  recurringInvoices: finance.recurringInvoices, bankAccounts: finance.bankAccounts,
  transactions: finance.transactions,
  leaves: hr.leaves, leaveQuota: hr.leaveQuota, shifts: hr.shifts, holidays: hr.holidays,
  appreciations: hr.appreciations, awards: hr.awards,
  emergencyContacts: hr.emergencyContacts, documents: hr.documents,
  salaries: people2.salaries, salaryHistory: people2.salaryHistory, payslips: people2.payslips,
  overtimeRequests: people2.overtimeRequests, objectives: people2.objectives,
  keyResults: people2.keyResults, meetings: people2.meetings,
  jobs: recruit.jobs, applications: recruit.applications, interviews: recruit.interviews,
  offers: recruit.offers, funnel: recruit.funnel,
  tickets: ops.tickets, events: ops.events, notices: ops.notices, kbArticles: ops.kbArticles,
  assets: ops.assets, biolinks: ops.biolinks, letterTemplates: ops.letterTemplates,
  generatedLetters: ops.generatedLetters, qrCodes: ops.qrCodes,
  webhooks: ops.webhooks, hostings: ops.hostings,
  domains: ops.domains, biometricDevices: ops.biometricDevices, biometricLogs: ops.biometricLogs,
  notifications: ops.notifications, todos: ops.todos,
  channels: collab.channels, channelMessages: collab.channelMessages,
  floors: collab.floors, officeRooms: collab.officeRooms,
  teamMeetings: collab.teamMeetings, recordings: collab.recordings,
  mailAccounts: mail.mailAccounts, mailFolders: mail.mailFolders,
  mailMessages: mail.mailMessages, mailContacts: mail.mailContacts,
  settings: admin.settings, rolePermissions: admin.rolePermissions,
};

export const collectionNames = () => Object.keys(collections);

/** The live array behind a collection, for code that needs it by name. */
export const getCollection = (name: string): Array<Record<string, unknown>> =>
  (collections[name] ?? []) as Array<Record<string, unknown>>;

/**
 * Server-backed, but loaded by a dedicated function rather than the adapter
 * table — because each needs more than a list request (a transcript per
 * channel, a mailbox spanning folders, settings merged per key).
 */
const BACKED_ELSEWHERE = new Set([
  "channelMessages",
  "mailMessages",
  "mailFolders",
  "mailContacts",
  "settings",
  "rolePermissions",
]);

/** True when the server accepts creates and deletes here but never edits. */
export const isAppendOnly = (collection: string) =>
  Boolean(ADAPTERS[collection]?.appendOnly);

/** True when this collection comes from the API rather than browser storage. */
export const isBacked = (collection: string) =>
  collection in ADAPTERS || BACKED_ELSEWHERE.has(collection);

/** The collections with no endpoint yet — they persist to this browser only. */
export const LOCAL_ONLY = Object.keys(collections).filter((c) => !isBacked(c));

/* ------------------------------------------------------------- listeners */

const listeners = new Set<() => void>();

/** Fires after any write, so a page can re-read a collection it doesn't own. */
export const onStoreChange = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const changed = () => listeners.forEach((fn) => fn());

/* --------------------------------------------- local-only persistence */

const STORE_KEY = "ws.local.v2";
const pristine = new Map<string, unknown[]>(
  LOCAL_ONLY.map((name) => [name, structuredClone(collections[name] ?? [])])
);

let saveTimer: number | undefined;

function persistLocal() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      const slice = Object.fromEntries(LOCAL_ONLY.map((n) => [n, collections[n]]));
      localStorage.setItem(STORE_KEY, JSON.stringify(slice));
    } catch {
      announce({ status: 0, message: "Couldn't save — this browser's storage is full or blocked" });
    }
  }, 120);
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved: Record<string, unknown[]> = JSON.parse(raw);
    for (const name of LOCAL_ONLY) {
      const rows = saved[name];
      const target = collections[name];
      if (target && Array.isArray(rows)) target.splice(0, target.length, ...rows);
    }
  } catch {
    /* private window or corrupt JSON — run on seed data */
  }
}

/** Put the local-only collections back to their shipped contents. */
export function resetDemoData() {
  for (const name of LOCAL_ONLY) {
    const fresh = structuredClone(pristine.get(name) ?? []);
    (collections[name] ?? []).splice(0, (collections[name] ?? []).length, ...fresh);
  }
  localAudit = [];
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* nothing we can do */
  }
  changed();
}

/** Rough footprint of what this browser is holding, for Settings > Storage. */
export function storeSize() {
  try {
    const bytes = new Blob([localStorage.getItem(STORE_KEY) ?? ""]).size;
    const records = LOCAL_ONLY.reduce((a, n) => a + (collections[n]?.length ?? 0), 0);
    const server = Object.keys(ADAPTERS).reduce((a, n) => a + (collections[n]?.length ?? 0), 0);
    return { bytes, records, collections: LOCAL_ONLY.length, serverRecords: server };
  } catch {
    return { bytes: 0, records: 0, collections: LOCAL_ONLY.length, serverRecords: 0 };
  }
}

/* ---------------------------------------------------------------- session */

export type Profile = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  organizationId: string;
  organizationName: string;
  roles: string[];
  permissions: string[];
  employeeId?: string | null;
};

let profile: Profile | null = null;
export const currentProfile = () => profile;

const profileListeners = new Set<(p: Profile | null) => void>();
export const onProfileChange = (fn: (p: Profile | null) => void) => {
  profileListeners.add(fn);
  return () => {
    profileListeners.delete(fn);
  };
};

/**
 * Does the signed-in account hold this permission?
 *
 * The owner carries `*`. A module wildcard (`invoices:*`) covers every action
 * on it. This is for deciding what to ask for and what to offer — the server
 * checks the same thing again on every request, and its answer is the one that
 * counts.
 */
export function can(permission: string): boolean {
  const held = profile?.permissions;
  if (!held?.length) return false;
  if (held.includes("*") || held.includes(permission)) return true;
  const [module] = permission.split(":");
  return held.includes(`${module}:*`);
}

const setProfile = (p: Profile | null) => {
  profile = p;
  profileListeners.forEach((fn) => fn(p));
};

/** Kept for the handful of callers that only need to know if a session exists. */
export const auth = {
  get token() {
    return tokens.access;
  },
};

/* ---------------------------------------------------------------- loading */

let loaded = false;
export const storeLoaded = () => loaded;

const splice = (name: string, rows: unknown[]) => {
  const target = collections[name];
  if (target) target.splice(0, target.length, ...rows);
  else collections[name] = rows;
};

/** Largest page the API will hand back in one request. */
const PAGE_SIZE = 200;
/** Stop after this many rows per collection, so one huge table can't stall boot. */
const MAX_ROWS = 2_000;

/**
 * Read one collection from the API and translate it into page shape.
 *
 * Pages are followed rather than taking the first 200 and stopping: a list that
 * silently shows a fraction of the records is worse than a slow one. The cap is
 * a safety valve — a collection past it needs the table to page against the
 * server rather than holding everything in memory.
 */
async function pull(name: string, adapter: Adapter): Promise<void> {
  const collected: Row[] = [];

  // A bare endpoint returns the whole list and takes no paging parameters —
  // sending them is a validation error, not a harmless extra.
  if (adapter.bare) {
    const body = await request<Row[]>(adapter.path, {
      query: { ...(adapter.query ?? {}) },
      quiet: true,
    });
    splice(name, (body ?? []).map((r) => adapter.fromServer(r)));
    return;
  }

  let page = 1;
  for (;;) {
    const body = await request<unknown>(adapter.path, {
      query: { limit: PAGE_SIZE, page, ...(adapter.query ?? {}) },
      quiet: true,
    });

    if (Array.isArray(body)) {
      collected.push(...(body as Row[]));
      break;
    }

    const envelope = body as Paginated<Row>;
    collected.push(...(envelope?.data ?? []));

    const pages = envelope?.meta?.pages ?? 1;
    if (page >= pages || collected.length >= MAX_ROWS) {
      if (collected.length >= MAX_ROWS && page < pages) {
        console.warn(
          `[worksuite] ${name} has more than ${MAX_ROWS} rows; showing the first ${collected.length}.`
        );
      }
      break;
    }
    page += 1;
  }

  splice(name, collected.map((r) => adapter.fromServer(r)));
}

/**
 * Load everything the app needs to render.
 *
 * Employees come first and on their own: every other adapter translates user
 * ids into employee ids through the map they build, so pulling them in parallel
 * would leave assignees and owners unresolved on the first paint.
 */
export async function hydrate(): Promise<boolean> {
  loadLocal();

  if (!tokens.access && !tokens.refresh) {
    loaded = true;
    return false;
  }

  try {
    setProfile(await request<Profile>("/auth/me", { quiet: true }));
  } catch (err) {
    // Only give up the session when the server actually rejects it. A server
    // that is restarting, or a laptop that woke up on a dead network, fails
    // here too — and signing someone out because their wifi dropped is a bug,
    // not a security measure. The token is still good; the next request will
    // prove it either way.
    const rejected = err instanceof ApiError && (err.status === 401 || err.status === 403);
    if (rejected) {
      tokens.clear();
      setProfile(null);
    } else {
      announce({ status: 0, message: "Can't reach the server — showing what was already loaded" });
    }
    loaded = true;
    return false;
  }

  /* Ask only for what this account may read. The alternative — request
     everything and let the server refuse — fills the console with 403s and,
     worse, leaves the seed rows sitting there looking like real records. */
  const allowed: Array<[string, Adapter]> = [];
  for (const [name, adapter] of Object.entries(ADAPTERS)) {
    if (adapter.skipHydrate) continue;
    if (!adapter.permission || can(adapter.permission)) allowed.push([name, adapter]);
    // Nothing this account may see, so show nothing rather than demo data.
    else splice(name, []);
  }

  const employees = allowed.find(([name]) => name === "employees");
  if (employees) {
    try {
      await pull("employees", employees[1]);
      learnPeople(collections.employees as Row[]);
    } catch {
      /* the rest can still load */
    }
  }

  const rest = allowed.filter(([name]) => name !== "employees");
  const results = await Promise.allSettled(rest.map(([name, a]) => pull(name, a)));

  const failed = rest
    .filter((_, i) => results[i].status === "rejected")
    .map(([name]) => name);
  if (failed.length) {
    // Not fatal — but say so once rather than letting stale rows pass for real.
    console.warn(`[worksuite] couldn't load: ${failed.join(", ")}`);
    for (const name of failed) splice(name, []);
  }

  /* The mailbox is loaded here too, not just on the Mail screen: the shell
     and the portals show an unread count, and a count taken from leftover seed
     data is worse than no count at all. */
  const mailbox = can("mail:manage")
    ? import("./mail").then((m) => Promise.all([m.loadAccounts(), m.loadMailbox()]))
    : Promise.resolve();

  /* Gated for the same reason the collections are: firing a request that can
     only come back 403 fills the server's log with denials that look like
     attacks and tells the user nothing. */
  await Promise.allSettled([
    can("settings:read") ? loadSettings() : Promise.resolve(),
    can("roles:read") ? loadRoles() : Promise.resolve(),
    can("audit:read") ? loadAudit() : Promise.resolve(),
    mailbox,
  ]);

  loaded = true;
  changed();
  return true;
}

/* ----------------------------------------------------------- audit trail */

export type AuditEntry = {
  id: string;
  action: "created" | "updated" | "deleted";
  collection: string;
  recordId: string;
  summary: string;
  by: string;
  at: string;
};

const AUDIT_ACTION: Record<string, AuditEntry["action"]> = {
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "deleted",
  APPROVE: "updated",
  REJECT: "updated",
  PAYMENT: "updated",
};

/** Server-side trail — the authoritative one. */
let serverAudit: AuditEntry[] = [];
/** Entries for the collections that still have no endpoint. */
let localAudit: AuditEntry[] = [];

const auditListeners = new Set<(l: AuditEntry[]) => void>();
const emitAudit = () => auditListeners.forEach((l) => l(audit.all()));

async function loadAudit(): Promise<void> {
  try {
    const body = await request<Paginated<Row>>("/audit", { query: { limit: 100 }, quiet: true });
    serverAudit = (body.data ?? []).map((r) => ({
      id: String(r.id),
      action: AUDIT_ACTION[String(r.action)] ?? "updated",
      collection: String(r.entity ?? "").toLowerCase(),
      recordId: String(r.entityId ?? ""),
      summary: String(r.summary ?? ""),
      by: r.actor?.name ?? "System",
      at: String(r.createdAt ?? ""),
    }));
  } catch {
    serverAudit = [];
  }
  emitAudit();
}

let actor = "Unknown user";
export const setAuditActor = (name: string) => {
  actor = name || "Unknown user";
};

const AUDIT_SKIP = new Set(["outbox", "attendanceLogs", "stockMovements", "assetMovements"]);

const describe = (patch: object) => {
  const entries = Object.entries(patch).filter(([k]) => !["id", "updated", "savedAt"].includes(k));
  if (entries.length === 0) return "record touched";
  return entries
    .slice(0, 3)
    .map(([k, v]) => `${k} → ${typeof v === "object" ? "…" : String(v).slice(0, 28)}`)
    .join(", ");
};

function record(action: AuditEntry["action"], collection: string, recordId: string, summary: string) {
  // The server writes its own entry for anything it stores; recording it here
  // too would show every change twice.
  if (isBacked(collection) || AUDIT_SKIP.has(collection)) return;
  localAudit = [
    {
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action,
      collection,
      recordId,
      summary,
      by: actor,
      at: new Date().toISOString(),
    },
    ...localAudit,
  ].slice(0, 300);
  emitAudit();
}

export const audit = {
  all: () =>
    [...serverAudit, ...localAudit]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 300),
  forRecord: (collection: string, recordId: string | number) =>
    audit.all().filter((a) => a.collection === collection && a.recordId === String(recordId)),
  subscribe: (fn: (l: AuditEntry[]) => void) => {
    auditListeners.add(fn);
    return () => {
      auditListeners.delete(fn);
    };
  },
  /** Refetch from the server — the trail isn't ours to clear any more. */
  refresh: loadAudit,
  clear: () => {
    localAudit = [];
    emitAudit();
  },
};

/* -------------------------------------------------------------- mutations */

const labelOf = (data: Row) =>
  String(data.name ?? data.title ?? data.number ?? data.subject ?? data.item ?? data.id ?? "record");

const listFor = (collection: string) => {
  if (!collections[collection]) collections[collection] = [];
  return collections[collection] as Row[];
};

const indexOf = (rows: Row[], id: unknown) => rows.findIndex((r) => String(r.id) === String(id));

/** A client-side id for the optimistic row, replaced by the server's on success. */
const tempId = (collection: string) => `tmp-${collection.slice(0, 3)}-${Date.now().toString(36)}`;

/**
 * Writes still in flight.
 *
 * `create`/`update`/`remove` return the optimistic row immediately — that is
 * the point of them — so a caller that needs to read back a *derived* value
 * (an account balance, an invoice status) has to know when the request itself
 * has landed. `await api.settled()` is that moment.
 */
const inFlight = new Set<Promise<unknown>>();

const track = (work: Promise<unknown>) => {
  inFlight.add(work);
  void work.finally(() => inFlight.delete(work));
};

export const api = {
  async login(email: string, password: string) {
    const body = await request<{ accessToken: string; refreshToken: string; user: Profile }>(
      "/auth/login",
      { method: "POST", body: { email, password }, anonymous: true, quiet: true }
    );
    tokens.set(body.accessToken, body.refreshToken);
    setProfile(body.user);
    setAuditActor(body.user?.name ?? "");
    await hydrate();
    return { token: body.accessToken, user: body.user };
  },

  async logout() {
    const refreshToken = tokens.refresh;
    tokens.clear();
    setProfile(null);
    if (refreshToken) {
      // Best effort: the local session is already gone either way.
      await request("/auth/logout", {
        method: "POST",
        body: { refreshToken },
        quiet: true,
      }).catch(() => undefined);
    }
  },

  create(collection: string, data: object) {
    const rows = listFor(collection);
    const row: Row = { ...(data as Row) };
    if (row.id == null) row.id = tempId(collection);

    // Callers that already pushed the row themselves land here too — upsert so
    // they don't end up with a duplicate.
    const at = indexOf(rows, row.id);
    if (at >= 0) rows[at] = { ...rows[at], ...row };
    else rows.unshift(row);

    record("created", collection, String(row.id), labelOf(row));
    changed();

    const adapter = ADAPTERS[collection];
    if (!adapter || adapter.readOnly) {
      persistLocal();
      return row;
    }

    track((async () => {
      try {
        const created = await request<Row>(adapter.path, {
          method: "POST",
          body: adapter.toServer ? adapter.toServer(row) : row,
        });
        const mapped = adapter.fromServer(created);
        const now = indexOf(rows, row.id);
        if (now >= 0) rows[now] = mapped;
        void loadAudit();
      } catch {
        // The row was never really created — take it back off the screen.
        const now = indexOf(rows, row.id);
        if (now >= 0) rows.splice(now, 1);
      }
      changed();
    })());

    return row;
  },

  update(collection: string, id: string | number, patch: object) {
    const rows = listFor(collection);
    const at = indexOf(rows, id);
    if (at < 0) return null;

    const before = { ...rows[at] };
    rows[at] = { ...rows[at], ...(patch as Row), id: rows[at].id };
    const optimistic = rows[at];

    record("updated", collection, String(id), describe(patch));
    changed();

    const adapter = ADAPTERS[collection];
    if (!adapter || adapter.readOnly || adapter.appendOnly) {
      // Append-only records have no update endpoint by design, so the edit
      // stays where the caller put it rather than being rolled back by a 404.
      persistLocal();
      return optimistic;
    }

    track((async () => {
      try {
        const updated = await request<Row>(`${adapter.path}/${id}`, {
          method: "PATCH",
          body: adapter.toServer ? adapter.toServer(patch as Row) : patch,
        });
        const now = indexOf(rows, id);
        if (now >= 0) rows[now] = adapter.fromServer(updated);
        void loadAudit();
      } catch {
        const now = indexOf(rows, id);
        if (now >= 0) rows[now] = before;
      }
      changed();
    })());

    return optimistic;
  },

  replace(collection: string, id: string | number, data: object) {
    const rows = listFor(collection);
    const at = indexOf(rows, id);
    if (at < 0) {
      return api.create(collection, { ...(data as Row), id });
    }
    return api.update(collection, id, data);
  },

  remove(collection: string, id: string | number) {
    const rows = listFor(collection);
    const at = indexOf(rows, id);
    if (at < 0) return { deleted: false };

    const before = rows[at];
    rows.splice(at, 1);
    record("deleted", collection, String(id), `deleted ${collection.replace(/s$/, "")}`);
    changed();

    const adapter = ADAPTERS[collection];
    if (!adapter || adapter.readOnly) {
      persistLocal();
      return { deleted: true };
    }

    track((async () => {
      try {
        await request(`${adapter.path}/${id}`, { method: "DELETE" });
        void loadAudit();
      } catch {
        // Put it back where it was, so the list doesn't silently reorder.
        rows.splice(Math.min(at, rows.length), 0, before);
        changed();
      }
    })());

    return { deleted: true };
  },

  /** Resolves once every write started so far has reached the server. */
  async settled() {
    while (inFlight.size) await Promise.allSettled([...inFlight]);
  },

  /** Re-read one collection from the server. */
  async refresh(collection: string) {
    const adapter = ADAPTERS[collection];
    if (!adapter) return false;
    try {
      await pull(collection, adapter);
      changed();
      return true;
    } catch {
      return false;
    }
  },
};

/* ---------------------------------------------------------------- offers */

/**
 * Accept an offer.
 *
 * This is not a status change: the server creates the employee record, opens
 * their salary and decrements the job's openings in one transaction. Doing it
 * here would leave three of those four things undone.
 */
export async function acceptOffer(id: string): Promise<boolean> {
  try {
    await request(`/offers/${id}/accept`, { method: "POST", body: {} });
    await Promise.all([api.refresh("offers"), api.refresh("employees"), api.refresh("jobs")]);
    void loadAudit();
    return true;
  } catch {
    return false;
  }
}

export async function declineOffer(id: string, reason?: string): Promise<boolean> {
  try {
    await request(`/offers/${id}/decline`, { method: "POST", body: reason ? { reason } : {} });
    await api.refresh("offers");
    void loadAudit();
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------- payroll */

/**
 * Set a new salary.
 *
 * Deliberately not an edit of the existing row: the server closes the current
 * band and writes the change, so the history survives. Both collections are
 * re-read afterwards because the server, not this call, decides what they now
 * contain.
 */
export async function reviseSalary(input: {
  employeeId: string;
  annualAmount: number;
  effectiveFrom: string;
  note?: string;
}): Promise<boolean> {
  try {
    await request("/salaries", { method: "POST", body: input });
    await Promise.all([api.refresh("salaries"), api.refresh("salaryHistory")]);
    void loadAudit();
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------- letters */

/**
 * Generate a letter from a template.
 *
 * The merge happens on the server — it owns the token vocabulary and the
 * employee data those tokens read — and the issued letter is stored there, so
 * a letter someone was shown can always be produced again.
 */
export async function generateLetter(input: {
  employeeId: string;
  templateId?: string;
  /** Overrides the template body when the user edited the preview. */
  body?: string;
}): Promise<Row | null> {
  try {
    const letter = await request<Row>("/letters/generate", { method: "POST", body: input });
    const rows = listFor("generatedLetters");
    rows.unshift(ADAPTERS.generatedLetters.fromServer(letter));
    void loadAudit();
    changed();
    return letter;
  } catch {
    return null;
  }
}

/** Preview the merge without issuing anything. */
export async function previewLetter(input: {
  employeeId: string;
  templateId?: string;
  body?: string;
}): Promise<string | null> {
  try {
    const res = await request<{ body: string }>("/letters/preview", { method: "POST", body: input });
    return res?.body ?? null;
  } catch {
    return null;
  }
}

/** Withdraw an issued letter. */
export async function removeGeneratedLetter(id: string): Promise<boolean> {
  const rows = listFor("generatedLetters");
  const at = rows.findIndex((r) => String(r.id) === String(id));
  const before = at >= 0 ? rows[at] : null;
  if (at >= 0) rows.splice(at, 1);
  changed();

  try {
    await request(`/letters/generated/${id}`, { method: "DELETE" });
    void loadAudit();
    return true;
  } catch {
    if (before) rows.splice(Math.min(at, rows.length), 0, before);
    changed();
    return false;
  }
}

/* ----------------------------------------------------------- attendance */

/** The API's statuses, as the codes the calendar draws with. */
const ATTENDANCE_CODE: Record<string, number> = {
  PRESENT: 1,
  LATE: 3,
  HALF_DAY: 3,
  ABSENT: 0,
  WEEKEND: 2,
  HOLIDAY: 2,
  ON_LEAVE: 4,
  PENDING: 5,
};

export type AttendanceGrid = {
  year: number;
  month: number;
  dayCount: number;
  rows: Array<{
    employeeId: string;
    name: string;
    code: string | null;
    days: number[];
    present: number;
    workingDays: number;
    percent: number;
  }>;
};

/**
 * A month of attendance for everyone.
 *
 * `month` is 1-12, matching the API rather than JavaScript's zero-based months.
 * The server resolves weekends, holidays and approved leave before falling back
 * to absent, so a blank day genuinely means nobody clocked in.
 */
export async function loadAttendanceGrid(
  month: number,
  year: number
): Promise<AttendanceGrid | null> {
  try {
    const body = await request<{
      year: number;
      month: number;
      dayCount: number;
      rows: Array<Row>;
    }>("/attendance/grid", { query: { month, year }, quiet: true });

    return {
      year: body.year,
      month: body.month,
      dayCount: body.dayCount,
      rows: (body.rows ?? []).map((r) => ({
        employeeId: String(r.employeeId),
        name: String(r.name ?? ""),
        code: r.employeeCode ?? null,
        days: (r.days ?? []).map((d: Row) => ATTENDANCE_CODE[String(d.status)] ?? 0),
        present: r.summary?.present ?? 0,
        workingDays: r.summary?.workingDays ?? 0,
        percent: r.summary?.percent ?? 0,
      })),
    };
  } catch {
    return null;
  }
}

/** Whether the signed-in user has clocked in today, and when. */
export async function attendanceToday(): Promise<{
  clockedIn: boolean;
  in: string | null;
  out: string | null;
}> {
  const clock = (iso: unknown) =>
    iso
      ? new Date(String(iso)).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : null;
  try {
    const body = await request<Row>("/attendance/today", { quiet: true });
    return {
      clockedIn: Boolean(body?.clockedIn),
      in: clock(body?.record?.clockInAt),
      out: clock(body?.record?.clockOutAt),
    };
  } catch {
    // Nobody has an attendance record on their first day; that isn't an error.
    return { clockedIn: false, in: null, out: null };
  }
}

export const clockIn = () => request<Row>("/attendance/clock-in", { method: "POST" });
export const clockOut = () => request<Row>("/attendance/clock-out", { method: "POST" });

/** HR correcting the record by hand. Always audited on the server. */
export function markAttendance(input: {
  employeeId: string;
  workDate: string;
  status: string;
  clockInAt?: string;
  clockOutAt?: string;
  note?: string;
}) {
  // Times arrive as "09:00 AM"; the API wants a full timestamp on that day.
  const at = (time?: string) => {
    if (!time?.trim()) return undefined;
    const parsed = new Date(`${input.workDate} ${time}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  };

  return request<Row>("/attendance/mark", {
    method: "POST",
    body: {
      employeeId: input.employeeId,
      workDate: input.workDate,
      status: input.status.trim().toUpperCase().replace(/\s+/g, "_"),
      clockInAt: at(input.clockInAt),
      clockOutAt: at(input.clockOutAt),
      note: input.note?.trim() || undefined,
    },
  });
}

/* ------------------------------------------------------------- channels */

export type ChatMessage = {
  id: string;
  channelId: string;
  threadId: string | null;
  userId: string;
  name: string;
  text: string;
  time: string;
  reactions: Record<string, number>;
};

/**
 * The transcript of one channel.
 *
 * Messages aren't hydrated with everything else — there can be a great many of
 * them and only the open channel's are worth fetching. Reactions come back as
 * who reacted; the UI wants how many.
 */
/** Last resort for a message whose author relation didn't come back. */
const nameOf = (userId: unknown): string => {
  const id = asEmployee(userId);
  const employee = (collections.employees as Row[]).find((e) => String(e.id) === String(id));
  return String(employee?.name ?? "Unknown");
};

export async function loadMessages(channelId: string, limit = 100): Promise<ChatMessage[]> {
  try {
    const body = await request<Paginated<Row> | Row[]>(`/channels/${channelId}/messages`, {
      query: { limit },
      quiet: true,
    });
    const rows = Array.isArray(body) ? body : (body?.data ?? []);
    return rows
      .map((m) => ({
        id: String(m.id),
        channelId: String(m.channelId ?? channelId),
        threadId: m.parentId ?? null,
        // Chat talks in user ids; the rest of the app talks in employee ids.
        userId: asEmployee(m.authorId) ?? "",
        name: m.author?.name ?? nameOf(m.authorId),
        text: String(m.body ?? ""),
        time: String(m.createdAt ?? ""),
        reactions: Object.fromEntries(
          Object.entries((m.reactions ?? {}) as Record<string, unknown>).map(([emoji, who]) => [
            emoji,
            Array.isArray(who) ? who.length : Number(who) || 0,
          ])
        ),
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------- settings & roles */

let settingsCache: Record<string, Record<string, unknown>> = {};

async function loadSettings(): Promise<void> {
  try {
    const rows = await request<Row[]>("/settings", { quiet: true });
    settingsCache = Object.fromEntries(
      (rows ?? []).map((r) => [String(r.key), (r.value ?? {}) as Record<string, unknown>])
    );
  } catch {
    settingsCache = {};
  }
}

export function getSetting(key: string): Record<string, unknown> {
  return settingsCache[key] ?? {};
}

/** Panes merge, so one tab can't wipe the fields another tab owns. */
export function saveSetting(key: string, values: Record<string, unknown>, _section = key) {
  const merged = { ...(settingsCache[key] ?? {}), ...values };
  settingsCache[key] = merged;
  changed();

  void request(`/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: { value: values },
  }).catch(() => {
    // Leave the optimistic value on screen but reload the truth, so the pane
    // shows what the server actually holds rather than what we hoped.
    void loadSettings().then(changed);
  });

  return { id: key, section: _section, values: merged, savedAt: new Date().toISOString() };
}

/* Grants in the UI are `{ module: { view, create, edit, delete } }`; the API
   speaks `module:action` permission keys. */
const ACTION_TO_UI: Record<string, string> = {
  read: "view",
  create: "create",
  update: "edit",
  delete: "delete",
};
const UI_TO_ACTION: Record<string, string> = {
  view: "read",
  create: "create",
  edit: "update",
  delete: "delete",
};

type Grants = Record<string, Record<string, boolean>>;

let roleCache: Array<{ id: string; key: string; name: string; permissions: string[] }> = [];

async function loadRoles(): Promise<void> {
  try {
    const rows = await request<Row[]>("/roles", { quiet: true });
    roleCache = (rows ?? []).map((r) => ({
      id: String(r.id),
      key: String(r.key),
      name: String(r.name),
      permissions: (r.permissions ?? []).map((p: any) =>
        typeof p === "string" ? p : String(p.key ?? p.permission?.key ?? "")
      ),
    }));
  } catch {
    roleCache = [];
  }
}

export const roleList = () => roleCache.map(({ id, key, name }) => ({ id, key, name }));

export function getRolePermissions(role: string): Grants | null {
  const found = roleCache.find((r) => r.key === role || r.name === role || r.id === role);
  if (!found) return null;

  // The owner holds the wildcard; expand it so every box shows ticked.
  const grants: Grants = {};
  for (const key of found.permissions) {
    if (key === "*") return { "*": { view: true, create: true, edit: true, delete: true } };
    const [module, action] = key.split(":");
    const ui = ACTION_TO_UI[action];
    if (!ui) continue;
    (grants[module] ??= {})[ui] = true;
  }
  return grants;
}

export function saveRolePermissions(role: string, grants: Grants) {
  const found = roleCache.find((r) => r.key === role || r.name === role || r.id === role);

  // Any write implies the ability to see the module.
  const normalised: Grants = {};
  for (const [module, perms] of Object.entries(grants)) {
    const row = { ...perms };
    if (row.create || row.edit || row.delete) row.view = true;
    normalised[module] = row;
  }

  const keys: string[] = [];
  for (const [module, perms] of Object.entries(normalised)) {
    for (const [ui, on] of Object.entries(perms)) {
      if (on && UI_TO_ACTION[ui]) keys.push(`${module}:${UI_TO_ACTION[ui]}`);
    }
  }

  if (found) {
    found.permissions = keys;
    void request(`/roles/${found.id}/permissions`, {
      method: "PUT",
      body: { permissions: keys },
    }).catch(() => void loadRoles().then(changed));
  }

  return { id: role, role, grants: normalised, updatedAt: new Date().toISOString() };
}

/* ----------------------------------------------------------- global search */

export type SearchHit = { type: string; id: string; label: string; sub: string; to: string };

const HIT_ROUTES: Record<string, (id: string, row: Row) => string> = {
  Employee: (id) => `/hr/employees/${id}`,
  Client: (id) => `/clients/${id}`,
  Project: (id) => `/work/projects/${id}`,
  Task: () => "/work/tasks",
  Invoice: (id) => `/finance/invoices/${id}`,
  Lead: () => "/leads",
  Ticket: () => "/tickets",
  Channel: (id) => `/chat?c=${id}`,
};

/** Server-side search across everything the signed-in user may see. */
export async function searchAll(query: string, limit = 5): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const results = await request<Array<Row>>("/search", {
      query: { q, limit },
      quiet: true,
    });
    return (results ?? []).map((r) => {
      const type = String(r.type ?? "Result");
      const id = String(r.id ?? "");
      return {
        type,
        id,
        label: String(r.label ?? ""),
        sub: String(r.sub ?? ""),
        to: r.to ? String(r.to) : (HIT_ROUTES[type]?.(id, r) ?? "/"),
      };
    });
  } catch {
    return searchLoaded(q, limit);
  }
}

/** Fallback: search what's already on the client, so search still works offline. */
function searchLoaded(query: string, limit: number): SearchHit[] {
  const q = query.toLowerCase();
  const pick = (
    name: string,
    type: string,
    label: (r: Row) => unknown,
    sub: (r: Row) => unknown,
    to: (r: Row) => string
  ): SearchHit[] =>
    ((collections[name] ?? []) as Row[])
      .filter((r) => `${label(r) ?? ""} ${sub(r) ?? ""}`.toLowerCase().includes(q))
      .slice(0, limit)
      .map((r) => ({
        type,
        id: String(r.id),
        label: String(label(r) ?? ""),
        sub: String(sub(r) ?? ""),
        to: to(r),
      }));

  return [
    ...pick("employees", "Employee", (r) => r.name, (r) => r.designation, (r) => `/hr/employees/${r.id}`),
    ...pick("clients", "Client", (r) => r.name, (r) => r.company, (r) => `/clients/${r.id}`),
    ...pick("projects", "Project", (r) => r.name, (r) => r.status, (r) => `/work/projects/${r.id}`),
    ...pick("tasks", "Task", (r) => r.title, (r) => r.code, () => "/work/tasks"),
    ...pick("invoices", "Invoice", (r) => r.number, (r) => r.status, (r) => `/finance/invoices/${r.id}`),
    ...pick("leads", "Lead", (r) => r.name, (r) => r.company, () => "/leads"),
    ...pick("tickets", "Ticket", (r) => r.subject, (r) => r.status, () => "/tickets"),
    ...pick("channels", "Channel", (r) => `#${r.name}`, (r) => r.desc, (r) => `/chat?c=${r.id}`),
  ];
}

/* --------------------------------------------------------------- invoices */

export type PayResult =
  | { error: string }
  | { payment: Record<string, unknown>; paid: number; status: string };

/**
 * Record a payment against an invoice.
 *
 * The server owns this: it inserts the payment and recomputes the balance and
 * status in one transaction, and refuses overpayment. We only reflect the
 * answer it gives back.
 */
export async function payInvoice(id: string, amount?: number): Promise<PayResult | null> {
  const invoices = (collections.invoices ?? []) as Row[];
  const inv = invoices.find((i) => String(i.id) === String(id));
  if (!inv) return null;

  const outstanding = num(inv.total) - num(inv.paid);
  if (outstanding <= 0) return { error: "Invoice is already settled" };

  const value = amount == null ? outstanding : Number(amount);
  if (!Number.isFinite(value) || value <= 0) return { error: "Amount must be a positive number" };

  try {
    const res = await request<{ payment: Row; invoice: Row }>(`/invoices/${id}/pay`, {
      method: "POST",
      body: { amount: value, paidOn: new Date().toISOString().slice(0, 10), method: "Manual" },
      quiet: true,
    });

    const mapped = ADAPTERS.invoices.fromServer(res.invoice);
    const at = invoices.findIndex((i) => String(i.id) === String(id));
    if (at >= 0) invoices[at] = mapped;

    const payments = listFor("payments");
    payments.unshift(ADAPTERS.payments.fromServer(res.payment));

    void loadAudit();
    changed();
    return { payment: res.payment, paid: mapped.paid, status: mapped.status };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Couldn't record the payment" };
  }
}
