/**
 * Translation between the API's shapes and the shapes these pages read.
 *
 * The server normalises: relations, `SCREAMING_ENUM` statuses, ISO timestamps,
 * decimals as strings. The pages denormalise: `department: "Engineering"`,
 * `status: "In Progress"`, `date: "2026-08-01"`, `total: 14410`. Neither is
 * wrong, so the translation lives here rather than being smeared across forty
 * page components.
 *
 * Each entry says where a collection lives on the API, how a server row becomes
 * a page row (`fromServer`), and how a page's edit becomes a request body
 * (`toServer`). A collection with no entry is local-only — it has no endpoint
 * yet and keeps working off the seed data in `@/data`.
 */

import { clients, employees } from "@/data/core";
import { leaveTypeIdFor } from "@/lib/leaveBalance";

type Row = Record<string, any>;

/* ------------------------------------------------------------- primitives */

/** "2026-08-01T00:00:00.000Z" → "2026-08-01". The pages only ever show the day. */
export const day = (value: unknown): string =>
  typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : "";

const dayOrNull = (value: unknown): string | null => (value ? day(value) : null);

/** Prisma sends Decimal as a string so it doesn't lose precision in JSON. */
export const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** "IN_PROGRESS" → "In Progress" */
export const title = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

/** "In Progress" → "IN_PROGRESS" */
export const scream = (value: unknown): string =>
  String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");

/** ISO timestamp → "04:54 pm", matching what the time-log rows show. */
const clock = (value: unknown): string => {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
    .toLowerCase();
};

const dateTime = (value: unknown): string =>
  value ? `${day(value)} ${clock(value)}`.trim() : "";

/* ------------------------------------------------------- identity mapping */

/**
 * The app talks about people as employees; parts of the API talk about them as
 * users (a task assignee, a ticket owner). One map, filled when the employee
 * list loads, lets every adapter translate either way without caring which
 * kind of id it was handed.
 */
const employeeByUser = new Map<string, string>();
const userByEmployee = new Map<string, string>();

export function learnPeople(employees: Row[]): void {
  employeeByUser.clear();
  userByEmployee.clear();
  for (const e of employees) {
    if (e?.userId && e?.id) {
      employeeByUser.set(String(e.userId), String(e.id));
      userByEmployee.set(String(e.id), String(e.userId));
    }
  }
}

/** Whatever id the server gave us, expressed as the employee id pages use. */
export const asEmployee = (id: unknown): string | undefined => {
  if (!id) return undefined;
  const key = String(id);
  return employeeByUser.get(key) ?? key;
};

/** The inverse, for writes. Falls back to the id given if the person has no login. */
export const asUser = (id: unknown): string | undefined => {
  if (!id) return undefined;
  const key = String(id);
  return userByEmployee.get(key) ?? key;
};

/* ---------------------------------------------------------------- adapter */

export type Adapter = {
  /** API path for the collection, e.g. "/clients". */
  path: string;
  /** Server row → page row. */
  fromServer: (row: Row) => Row;
  /** Page row or patch → request body. Return undefined to skip a write. */
  toServer?: (patch: Row) => Row;
  /** Fixed query parameters for the list request. */
  query?: Record<string, unknown>;
  /** Set when the endpoint returns a bare array rather than a paginated envelope. */
  bare?: boolean;
  /** Writes aren't supported here; the page's optimistic edit stays local. */
  readOnly?: boolean;
  /**
   * The permission that gates this collection, e.g. "invoices:read". Omitted
   * for the personal ones (your own todos, your own bell), which everybody has.
   * Used to skip requests that would only come back 403.
   */
  permission?: string;
  /**
   * Skip this one at boot. For collections only ever read a page at a time
   * (`useServerRows`), where loading the whole thing up front would be work
   * nothing uses.
   */
  skipHydrate?: boolean;
  /**
   * Rows can be created and deleted but never edited.
   *
   * These are records of something that happened — a punch at a door, an award
   * given, a salary band, an offer sent — and the server has no PATCH for them
   * on purpose. Saying so here stops the app firing a request that can only
   * 404 and then rolling the edit back.
   */
  appendOnly?: boolean;
};

/**
 * Drop keys whose value is undefined, so a partial edit never sends `null`
 * over a field the user didn't touch.
 */
const defined = (row: Row): Row =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A reference to another employee, on its way to the server.
 *
 * The form's picker is a list of names with "--" at the top, because
 * SelectInput carries strings; an edit loaded from the server carries the id
 * instead. The API wants a UUID or nothing, and "--" is neither — sending it
 * raw is what made the first employee impossible to create on an empty
 * database, since "nobody to report to" was the only option available.
 */
const employeeRef = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !value || value === "--") return undefined;
  if (UUID.test(value)) return value;
  return employees.find((e) => e.name === value)?.id;
};

/**
 * A date on its way to the server.
 *
 * `day()` renders a missing date as "" so the page has something to show;
 * sending that back fails validation, because "" is not a date. Anything empty
 * is simply left out of the patch.
 */
const dateOut = (value: unknown): string | undefined => {
  const v = typeof value === "string" ? value.trim() : value;
  return v ? String(v) : undefined;
};

export const ADAPTERS: Record<string, Adapter> = {
  /* ------------------------------------------------------------- people */

  employees: {
    path: "/employees",
    permission: "employees:read",
    fromServer: (r) => ({
      id: r.id,
      userId: r.userId ?? undefined,
      name: r.name,
      code: r.employeeCode,
      designation: r.designation?.name ?? "",
      designationId: r.designationId ?? undefined,
      department: r.department?.name ?? "",
      departmentId: r.departmentId ?? undefined,
      email: r.email,
      phone: r.phone ?? "",
      status: r.status === "ACTIVE" ? "Active" : "Inactive",
      joined: day(r.joinedOn),
      reportsTo: r.reportsToId ?? undefined,
      hourly: num(r.hourlyRate),
      avatar: r.user?.avatarUrl ?? undefined,
    }),
    toServer: (p) =>
      defined({
        name: p.name,
        email: p.email,
        phone: p.phone,
        departmentId: p.departmentId,
        designationId: p.designationId,
        reportsToId: employeeRef(p.reportsTo),
        joinedOn: dateOut(p.joined),
        hourlyRate: p.hourly,
        status: p.status ? (p.status === "Active" ? "ACTIVE" : "INACTIVE") : undefined,
      }),
  },

  departments: {
    path: "/departments",
    permission: "departments:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      parent: r.parent?.name ?? null,
      parentId: r.parentId ?? undefined,
      members: r._count?.employees ?? 0,
    }),
    toServer: (p) => defined({ name: p.name, parentId: p.parentId }),
  },

  designations: {
    path: "/designations",
    permission: "departments:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      parent: r.parent?.name ?? null,
      parentId: r.parentId ?? undefined,
    }),
    toServer: (p) => defined({ name: p.name, parentId: p.parentId }),
  },

  clients: {
    path: "/clients",
    permission: "clients:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      company: r.company,
      email: r.email ?? "",
      phone: r.phone ?? "",
      category: r.category ?? "",
      added: day(r.createdAt),
      status: r.status === "ACTIVE" ? "Active" : "Inactive",
      projects: r._count?.projects ?? 0,
      invoices: r._count?.invoices ?? 0,
    }),
    toServer: (p) =>
      defined({
        name: p.name,
        company: p.company,
        email: p.email,
        phone: p.phone,
        category: p.category,
        status: p.status ? (p.status === "Active" ? "ACTIVE" : "INACTIVE") : undefined,
      }),
  },

  /* ------------------------------------------------------------- work */

  projects: {
    path: "/projects",
    permission: "projects:read",
    fromServer: (r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      clientId: r.clientId ?? undefined,
      client: r.client?.company ?? r.client?.name ?? "",
      members: (r.members ?? []).map((m: Row) => asEmployee(m.userId ?? m.user?.id)).filter(Boolean),
      start: day(r.startsOn),
      deadline: day(r.deadlineOn),
      progress: r.progress ?? 0,
      status: title(r.status),
      budget: num(r.budget),
      category: r.category ?? "",
      taskCount: r._count?.tasks ?? 0,
    }),
    toServer: (p) =>
      defined({
        name: p.name,
        code: p.code,
        clientId: p.clientId,
        startsOn: dateOut(p.start),
        deadlineOn: dateOut(p.deadline),
        progress: p.progress,
        status: p.status ? scream(p.status) : undefined,
        budget: p.budget,
        category: p.category,
      }),
  },

  tasks: {
    path: "/tasks",
    permission: "tasks:read",
    fromServer: (r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      projectId: r.projectId ?? undefined,
      project: r.project?.name ?? "",
      milestoneId: r.milestoneId ?? undefined,
      assignees: (r.assignees ?? [])
        .map((a: Row) => asEmployee(a.userId ?? a.user?.id))
        .filter(Boolean),
      due: day(r.dueOn),
      status: title(r.status),
      priority: title(r.priority),
      label: r.sourceType ?? "",
      hours: num(r.estimatedHours),
    }),
    toServer: (p) =>
      defined({
        title: p.title,
        projectId: p.projectId,
        milestoneId: p.milestoneId,
        dueOn: dateOut(p.due),
        status: p.status ? scream(p.status) : undefined,
        priority: p.priority ? scream(p.priority) : undefined,
        estimatedHours: p.hours,
        assigneeIds: Array.isArray(p.assignees)
          ? p.assignees.map(asUser).filter(Boolean)
          : undefined,
      }),
  },

  milestones: {
    path: "/milestones",
    permission: "milestones:read",
    fromServer: (r) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      cost: num(r.cost),
      status: title(r.status),
      tasks: r._count?.tasks ?? 0,
      due: day(r.dueOn),
    }),
    toServer: (p) =>
      defined({
        projectId: p.projectId,
        title: p.title,
        cost: p.cost,
        dueOn: dateOut(p.due),
        status: p.status ? scream(p.status) : undefined,
      }),
  },

  timeLogs: {
    path: "/time-logs",
    permission: "timelogs:read",
    fromServer: (r) => ({
      id: r.id,
      taskId: r.taskId ?? undefined,
      projectId: r.projectId ?? undefined,
      employee: r.employeeId,
      start: dateTime(r.startedAt),
      end: dateTime(r.endedAt),
      hours: num(r.hours),
      memo: r.note ?? "",
    }),
    toServer: (p) =>
      defined({
        taskId: p.taskId,
        projectId: p.projectId,
        employeeId: p.employee,
        startedAt: p.start ? new Date(p.start).toISOString() : undefined,
        endedAt: p.end ? new Date(p.end).toISOString() : undefined,
        hours: p.hours,
        note: p.memo,
      }),
  },

  /* ---------------------------------------------------------- finance */

  invoices: {
    path: "/invoices",
    permission: "invoices:read",
    fromServer: (r) => ({
      id: r.id,
      number: r.number,
      clientId: r.clientId ?? undefined,
      client: r.client?.company ?? "",
      projectId: r.projectId ?? undefined,
      total: num(r.total),
      subtotal: num(r.subtotal),
      tax: num(r.taxTotal),
      paid: num(r.paidAmount),
      date: day(r.issuedOn),
      due: day(r.dueOn),
      currency: r.currency ?? "USD",
      status: title(r.status),
      items: (r.items ?? []).map((i: Row) => ({
        id: i.id,
        description: i.description,
        quantity: num(i.quantity),
        unitPrice: num(i.unitPrice),
        amount: num(i.amount),
      })),
    }),
    toServer: (p) =>
      defined({
        clientId: p.clientId,
        projectId: p.projectId,
        issuedOn: dateOut(p.date),
        dueOn: dateOut(p.due),
        currency: p.currency,
        note: p.note,
        status: p.status ? scream(p.status) : undefined,
        // Only when there are lines: sending an empty array would read as
        // "this invoice has no lines", which the server rightly refuses.
        items: Array.isArray(p.items) && p.items.length
          ? p.items.map((i: Row) => ({
              description: i.description,
              quantity: num(i.quantity) || 1,
              unitPrice: num(i.unitPrice ?? i.amount),
            }))
          : undefined,
      }),
  },

  estimates: {
    path: "/estimates",
    permission: "estimates:read",
    fromServer: (r) => ({
      id: r.id,
      number: r.number,
      clientId: r.clientId ?? undefined,
      client: r.client?.company ?? "",
      total: num(r.total),
      date: day(r.issuedOn),
      valid: day(r.validUntil),
      status: r.status ?? "Draft",
      invoiceId: r.convertedInvoiceId ?? undefined,
    }),
    toServer: (p) =>
      defined({
        clientId: p.clientId,
        number: p.number,
        issuedOn: dateOut(p.date),
        validUntil: dateOut(p.valid),
        total: p.total,
        status: p.status,
      }),
  },

  payments: {
    path: "/payments",
    permission: "payments:read",
    fromServer: (r) => ({
      id: r.id,
      invoiceId: r.invoiceId,
      invoice: r.invoice?.number ?? "",
      clientId: r.invoice?.client?.id ?? undefined,
      // Carried on the row so the table doesn't need the invoice list loaded.
      client: r.invoice?.client?.company ?? "",
      amount: num(r.amount),
      date: day(r.paidOn),
      gateway: r.method ?? "Manual",
      account: r.reference ?? "",
    }),
    readOnly: true, // payments are created through /invoices/:id/pay
  },

  expenses: {
    path: "/expenses",
    permission: "expenses:read",
    fromServer: (r) => ({
      id: r.id,
      item: r.item,
      price: num(r.amount),
      employee: r.employeeId ?? undefined,
      employeeName: r.employee?.name ?? "",
      project: r.projectId ?? "—",
      date: day(r.spentOn),
      status: title(r.status),
      category: r.category ?? "",
    }),
    toServer: (p) =>
      defined({
        item: p.item,
        amount: p.price,
        employeeId: p.employee,
        projectId: p.projectId,
        spentOn: dateOut(p.date),
        category: p.category,
      }),
  },

  /* -------------------------------------------------------------- CRM */

  leads: {
    path: "/leads",
    permission: "leads:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      company: r.company,
      email: r.email ?? "",
      phone: r.phone ?? "",
      source: r.source ?? "",
      owner: asEmployee(r.ownerId),
      status: title(r.status),
      value: num(r.value),
      added: day(r.createdAt),
      clientId: r.convertedClientId ?? undefined,
    }),
    toServer: (p) =>
      defined({
        name: p.name,
        company: p.company,
        email: p.email,
        phone: p.phone,
        source: p.source,
        ownerId: p.owner ? asUser(p.owner) : undefined,
        value: p.value,
        status: p.status ? scream(p.status) : undefined,
      }),
  },

  pipelineStages: {
    path: "/pipeline-stages",
    permission: "deals:read",
    fromServer: (r) => ({
      id: r.id,
      title: r.name,
      position: r.position,
      outcome: r.outcome,
      color: r.color ?? "#8b94a7",
    }),
    toServer: (p) => defined({ name: p.title, position: p.position, outcome: p.outcome }),
  },

  deals: {
    path: "/deals",
    permission: "deals:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.title,
      leadId: r.leadId ?? undefined,
      lead: r.lead?.name ?? "",
      value: num(r.value),
      stage: r.stageId,
      stageName: r.stage?.name ?? "",
      agent: asEmployee(r.ownerId),
      close: day(r.expectedCloseOn),
      probability: r.probability ?? 0,
      category: r.stage?.outcome === "WON" ? "Closed" : "Pipeline",
    }),
    toServer: (p) =>
      defined({
        title: p.name,
        leadId: p.leadId,
        stageId: p.stage,
        value: p.value,
        ownerId: p.agent ? asUser(p.agent) : undefined,
        expectedCloseOn: p.close,
        probability: p.probability,
      }),
  },

  /* --------------------------------------------------------------- HR */

  leaves: {
    path: "/leave",
    permission: "leave:read",
    fromServer: (r) => ({
      id: r.id,
      employee: r.employeeId,
      employeeName: r.employee?.name ?? "",
      type: r.leaveType?.name ?? "",
      leaveTypeId: r.leaveTypeId,
      date: day(r.startsOn),
      endDate: day(r.endsOn),
      days: num(r.days),
      duration: r.halfDay ? "Half Day" : "Full Day",
      status: title(r.status),
      reason: r.reason ?? "",
    }),
    toServer: (p) =>
      defined({
        employeeId: p.employee,
        // The pickers carry a type name; the API keys leave by type id. Fall
        // back to resolving the name so every entry point agrees.
        leaveTypeId: p.leaveTypeId ?? leaveTypeIdFor(String(p.type ?? "")),
        startsOn: dateOut(p.date),
        endsOn: dateOut(p.endDate ?? p.date),
        halfDay: p.duration === "Half Day" ? true : undefined,
        reason: p.reason,
      }),
  },

  shifts: {
    path: "/shifts",
    permission: "attendance:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      start: r.startsAt,
      end: r.endsAt,
      days: r.workingDays,
      color: r.color ?? "#5b5ceb",
    }),
    toServer: (p) =>
      defined({ name: p.name, startsAt: dateOut(p.start), endsAt: dateOut(p.end), workingDays: p.days }),
  },

  holidays: {
    path: "/holidays",
    permission: "attendance:read",
    fromServer: (r) => ({ id: r.id, name: r.name, date: day(r.holidayOn) }),
    toServer: (p) => defined({ name: p.name, holidayOn: p.date }),
  },

  /* ------------------------------------------------------- recruitment */

  jobs: {
    path: "/jobs",
    permission: "jobs:read",
    fromServer: (r) => ({
      id: r.id,
      title: r.title,
      departmentId: r.departmentId ?? undefined,
      department: r.department?.name ?? "",
      recruiter: asEmployee(r.createdById),
      start: day(r.opensOn),
      end: r.closesOn ? day(r.closesOn) : "No End Date",
      status: title(r.status),
      openings: r.openings ?? 1,
      type: title(r.employmentType),
      location: r.location ?? "",
      applicants: r._count?.applications ?? 0,
    }),
    toServer: (p) =>
      defined({
        title: p.title,
        departmentId: p.departmentId,
        location: p.location,
        openings: p.openings,
        employmentType: p.type ? scream(p.type) : undefined,
        status: p.status ? scream(p.status) : undefined,
        opensOn: dateOut(p.start),
        closesOn: p.end && p.end !== "No End Date" ? p.end : undefined,
      }),
  },

  applications: {
    path: "/applications",
    permission: "applications:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      jobId: r.jobId,
      job: r.job?.title ?? "",
      date: day(r.createdAt),
      status: title(r.stage),
      email: r.email,
      phone: r.phone ?? "",
      skills: r.skills ?? [],
      rating: r.rating ?? null,
      location: r.job?.location ?? "",
    }),
    toServer: (p) =>
      defined({
        jobId: p.jobId,
        name: p.name,
        email: p.email,
        phone: p.phone,
        skills: p.skills,
        rating: p.rating,
      }),
  },

  interviews: {
    path: "/interviews",
    permission: "interviews:read",
    fromServer: (r) => ({
      id: r.id,
      applicationId: r.applicationId,
      candidate: r.application?.name ?? "",
      job: r.application?.job?.title ?? "",
      date: day(r.scheduledAt),
      time: clock(r.scheduledAt),
      round: r.round ?? "",
      mode: r.mode ?? "",
      status: title(r.status),
      rating: r.rating ?? null,
    }),
    toServer: (p) =>
      defined({
        applicationId: p.applicationId,
        scheduledAt:
          p.date && p.time ? new Date(`${p.date} ${p.time}`).toISOString() : undefined,
        round: p.round,
        mode: p.mode,
      }),
  },

  offers: {
    path: "/offers",
    appendOnly: true,
    permission: "offers:read",
    fromServer: (r) => ({
      id: r.id,
      // There is no separate offer number on the server; the short id is the
      // reference people quote.
      offer: `Offer-${String(r.id).slice(0, 8)}`,
      applicationId: r.applicationId,
      applicant: r.application?.name ?? "",
      job: r.application?.job?.title ?? "",
      salary: num(r.salaryAmount),
      currency: r.currency ?? "USD",
      joining: day(r.startsOn),
      status: title(r.status),
      respondedAt: r.respondedAt ? day(r.respondedAt) : null,
      employeeId: r.createdEmployeeId ?? undefined,
    }),
    toServer: (p) =>
      defined({
        applicationId: p.applicationId,
        salaryAmount: p.salary,
        startsOn: dateOut(p.joining),
        currency: p.currency,
      }),
  },

  /* ------------------------------------------------------------- ops */

  tickets: {
    path: "/tickets",
    permission: "tickets:read",
    fromServer: (r) => ({
      id: r.id,
      number: r.number,
      subject: r.subject,
      body: r.body ?? "",
      clientId: r.clientId ?? undefined,
      requester: r.requesterName ?? r.client?.name ?? "",
      agent: asEmployee(r.assigneeId),
      priority: title(r.priority),
      status: title(r.status),
      updated: day(r.updatedAt),
      group: r.channel ?? "",
      type: r.channel ?? "",
      replies: r._count?.replies ?? 0,
    }),
    toServer: (p) =>
      defined({
        subject: p.subject,
        body: p.body,
        /* Picking a client as the requester should attach the ticket to that
           customer, not just copy their name into a text field — otherwise it
           never shows up against the client record. An internal requester is a
           colleague, so there is no client to link. */
        clientId:
          p.clientId ??
          clients.find((c) => c.name === p.requester)?.id,
        requesterName: p.requester,
        assigneeId: p.agent ? asUser(p.agent) : undefined,
        priority: p.priority ? scream(p.priority) : undefined,
        status: p.status ? scream(p.status) : undefined,
        channel: p.group,
      }),
  },

  events: {
    path: "/events",
    permission: "events:read",
    fromServer: (r) => ({
      id: r.id,
      title: r.title,
      date: day(r.startsAt),
      end: dayOrNull(r.endsAt),
      location: r.location ?? "",
      description: r.description ?? "",
      color: r.color ?? "#5b5ceb",
    }),
    toServer: (p) =>
      defined({
        title: p.title,
        startsAt: p.date ? new Date(p.date).toISOString() : undefined,
        endsAt: p.end ? new Date(p.end).toISOString() : undefined,
        location: p.location,
        description: p.description,
      }),
  },

  notices: {
    path: "/notices",
    permission: "notices:read",
    fromServer: (r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      to: r.audience ?? "All",
      date: day(r.publishedAt ?? r.createdAt),
      published: Boolean(r.publishedAt),
    }),
    toServer: (p) => defined({ title: p.title, body: p.body, audience: p.to }),
  },

  kbArticles: {
    path: "/knowledge",
    permission: "knowledge:read",
    fromServer: (r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      category: r.category ?? "",
      visibility: r.visibility ?? "Internal",
      views: r.views ?? 0,
      updated: day(r.updatedAt),
    }),
    toServer: (p) =>
      defined({
        title: p.title,
        body: p.body,
        category: p.category,
        visibility: p.visibility,
      }),
  },

  assets: {
    path: "/assets",
    permission: "assets:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      code: r.assetCode ?? "",
      type: r.category ?? "",
      serial: r.serialNumber ?? "",
      assignedTo: asEmployee(r.assignedToId),
      status: title(r.status),
      date: day(r.purchasedOn),
      value: num(r.cost),
    }),
    toServer: (p) =>
      defined({
        name: p.name,
        assetCode: p.code,
        category: p.type,
        serialNumber: p.serial,
        purchasedOn: dateOut(p.date),
        cost: p.value,
        status: p.status ? scream(p.status) : undefined,
      }),
  },

  letterTemplates: {
    path: "/letters/templates",
    permission: "letters:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      body: r.body,
      updated: day(r.updatedAt),
    }),
    toServer: (p) => defined({ name: p.name, body: p.body }),
  },

  generatedLetters: {
    path: "/letters/generated",
    permission: "letters:read",
    fromServer: (r) => ({
      id: r.id,
      templateId: r.templateId ?? undefined,
      template: r.template?.name ?? "",
      // Named `employee` because that is what the letters screen reads.
      employee: r.employeeId ?? undefined,
      employeeId: r.employeeId ?? undefined,
      body: r.body,
      date: day(r.issuedOn),
    }),
    readOnly: true, // created through /letters/generate
  },

  /* --------------------------------------------------- collaboration */

  channels: {
    path: "/channels",
    permission: "channels:read",
    fromServer: (r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      desc: r.description ?? "",
      kind: r.kind,
      unread: r.unread ?? 0,
      members: (r.members ?? []).map((m: Row) => asEmployee(m.userId)).filter(Boolean),
    }),
    toServer: (p) =>
      defined({ name: p.name, description: p.desc, kind: p.kind ? scream(p.kind) : undefined }),
  },

  /* -------------------------------------------------------- personal */

  notifications: {
    path: "/notifications",
    fromServer: (r) => ({
      id: r.id,
      text: r.title,
      body: r.body ?? "",
      kind: r.kind ?? "info",
      to: r.linkTo ?? undefined,
      read: Boolean(r.readAt),
      at: r.createdAt,
      time: relative(r.createdAt),
    }),
    readOnly: true,
  },

  todos: {
    path: "/todos",
    bare: true,
    fromServer: (r) => ({
      id: r.id,
      text: r.title,
      done: Boolean(r.done),
      due: dayOrNull(r.dueOn),
    }),
    toServer: (p) => defined({ title: p.text, done: p.done, dueOn: p.due }),
  },

  mailAccounts: {
    path: "/mail/accounts",
    permission: "mail:manage",
    bare: true,
    fromServer: (r) => ({
      id: r.id,
      name: r.displayName ?? r.email,
      email: r.email,
      provider: r.provider ?? "custom",
      imapHost: r.imapHost,
      imapPort: r.imapPort,
      smtpHost: r.smtpHost,
      smtpPort: r.smtpPort,
      status: r.status ?? "Connected",
      lastSyncAt: r.lastSyncAt ?? null,
    }),
    toServer: (p) =>
      defined({
        displayName: p.name,
        email: p.email,
        provider: p.provider,
        imapHost: p.imapHost,
        imapPort: p.imapPort,
        smtpHost: p.smtpHost,
        smtpPort: p.smtpPort,
        password: p.password,
      }),
  },

  /* ------------------------------------------------------------ sales */

  leadForms: {
    path: "/lead-forms",
    permission: "leads:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      fields: r.fields ?? [],
      active: r.active !== false,
      created: day(r.createdAt),
      submissions: r._count?.submissions ?? 0,
    }),
    toServer: (p) => defined({ name: p.name, slug: p.slug, fields: p.fields, active: p.active }),
  },

  leadEmails: {
    path: "/lead-emails",
    permission: "leads:read",
    fromServer: (r) => ({
      id: r.id,
      leadId: r.leadId,
      lead: r.lead?.name ?? "",
      subject: r.subject,
      body: r.body ?? "",
      to: r.toEmail,
      date: day(r.sentAt),
    }),
    toServer: (p) =>
      defined({ leadId: p.leadId, subject: p.subject, body: p.body, toEmail: p.to }),
  },

  proposals: {
    path: "/proposals",
    permission: "estimates:read",
    fromServer: (r) => ({
      id: r.id,
      number: r.number,
      title: r.title ?? "",
      leadId: r.leadId ?? undefined,
      leadName: r.lead?.company ?? r.lead?.name ?? "",
      total: num(r.total),
      date: day(r.issuedOn),
      valid: day(r.validUntil),
      status: r.status ?? "Draft",
    }),
    toServer: (p) =>
      defined({
        leadId: p.leadId,
        number: p.number,
        title: p.title,
        total: p.total,
        issuedOn: dateOut(p.date),
        validUntil: dateOut(p.valid),
        status: p.status,
      }),
  },

  /* ---------------------------------------------------------- finance */

  bankAccounts: {
    path: "/bank-accounts",
    permission: "payments:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      bank: r.bankName ?? "—",
      type: r.kind ?? "Bank",
      number: r.accountNumber ?? "—",
      // Computed from the ledger by the server; never a stored figure.
      balance: num(r.balance ?? r.openingBalance),
      currency: r.currency ?? "USD",
      status: "Active",
    }),
    toServer: (p) =>
      defined({
        name: p.name,
        bankName: p.bank === "—" ? undefined : p.bank,
        kind: p.type,
        accountNumber: p.number === "—" ? undefined : p.number,
        currency: p.currency,
        openingBalance: p.openingBalance,
      }),
  },

  transactions: {
    path: "/transactions",
    appendOnly: true,
    permission: "payments:read",
    fromServer: (r) => ({
      id: r.id,
      accountId: r.bankAccountId,
      account: r.bankAccount?.name ?? "",
      type: r.direction === "CREDIT" ? "Credit" : "Debit",
      amount: num(r.amount),
      date: day(r.occurredOn),
      memo: r.memo ?? "",
    }),
    toServer: (p) =>
      defined({
        bankAccountId: p.accountId,
        direction: p.type ? String(p.type).toUpperCase() : undefined,
        amount: p.amount,
        occurredOn: dateOut(p.date),
        memo: p.memo,
      }),
  },

  creditNotes: {
    path: "/credit-notes",
    permission: "invoices:read",
    fromServer: (r) => ({
      id: r.id,
      number: r.number,
      clientId: r.clientId ?? undefined,
      client: r.client?.company ?? "",
      invoiceId: r.invoiceId ?? undefined,
      total: num(r.amount),
      used: num(r.appliedAmount),
      date: day(r.issuedOn),
      // Derived, so it can never contradict the amounts beside it.
      status: num(r.appliedAmount) >= num(r.amount) ? "Closed" : "Open",
      reason: r.reason ?? "",
    }),
    toServer: (p) =>
      defined({
        clientId: p.clientId,
        invoiceId: p.invoiceId,
        number: p.number,
        total: p.total,
        issuedOn: dateOut(p.date),
        reason: p.reason,
      }),
  },

  recurringInvoices: {
    path: "/recurring-invoices",
    permission: "invoices:read",
    fromServer: (r) => ({
      id: r.id,
      clientId: r.clientId ?? undefined,
      client: r.client?.company ?? "",
      amount: num(r.amount),
      cycle: r.cycle ?? "Monthly",
      nextRun: day(r.nextRunOn),
      startedOn: day(r.startedOn),
      issued: r.issuedCount ?? 0,
      status: r.status ?? "Active",
      memo: r.memo ?? "",
    }),
    toServer: (p) =>
      defined({
        clientId: p.clientId,
        amount: p.amount,
        cycle: p.cycle,
        startedOn: dateOut(p.startedOn),
        nextRunOn: dateOut(p.nextRun),
        status: p.status,
        memo: p.memo,
      }),
  },

  recurringExpenses: {
    path: "/recurring-expenses",
    permission: "expenses:read",
    fromServer: (r) => ({
      id: r.id,
      item: r.item,
      category: r.category ?? "",
      price: num(r.amount),
      cycle: r.cycle ?? "Monthly",
      next: day(r.nextRunOn),
      status: r.status ?? "Active",
    }),
    toServer: (p) =>
      defined({
        item: p.item,
        category: p.category,
        amount: p.price,
        cycle: p.cycle,
        nextRunOn: dateOut(p.next),
        status: p.status,
      }),
  },

  /* ------------------------------------------------------- people ops */

  salaries: {
    path: "/salaries",
    appendOnly: true,
    permission: "payroll:read",
    fromServer: (r) => ({
      id: r.id,
      employee: r.employeeId,
      employeeName: r.employee?.name ?? "",
      annual: num(r.annualAmount),
      monthly: Math.round((num(r.annualAmount) / 12) * 100) / 100,
      currency: r.currency ?? "USD",
      cycle: "Monthly",
      from: day(r.effectiveFrom),
      to: r.effectiveTo ? day(r.effectiveTo) : null,
    }),
    toServer: (p) =>
      defined({ employeeId: p.employee, annualAmount: p.annual, effectiveFrom: p.from }),
  },

  salaryHistory: {
    path: "/salaries/history",
    permission: "payroll:read",
    fromServer: (r) => ({
      id: r.id,
      employee: r.employeeId,
      employeeName: r.employee?.name ?? "",
      from: num(r.fromAmount),
      to: num(r.toAmount),
      date: day(r.effectiveOn),
      note: r.note ?? "",
    }),
    readOnly: true, // written as a side effect of setting a salary
  },

  payslips: {
    path: "/payslips",
    permission: "payroll:read",
    fromServer: (r) => ({
      id: r.id,
      employee: r.employeeId,
      employeeName: r.employee?.name ?? "",
      period: new Date(r.periodStart).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      }),
      periodStart: day(r.periodStart),
      periodEnd: day(r.periodEnd),
      gross: num(r.gross),
      deductions: num(r.deductions),
      net: num(r.net),
      status: title(r.status),
      paidOn: r.paidOn ? day(r.paidOn) : null,
    }),
    toServer: (p) =>
      defined({
        employeeId: p.employee,
        periodStart: dateOut(p.periodStart),
        periodEnd: dateOut(p.periodEnd),
        gross: p.gross,
        deductions: p.deductions,
      }),
  },

  overtimeRequests: {
    path: "/overtime",
    permission: "attendance:read",
    fromServer: (r) => ({
      id: r.id,
      employee: r.employeeId,
      employeeName: r.employee?.name ?? "",
      date: day(r.workedOn),
      hours: num(r.hours),
      reason: r.reason ?? "",
      status: title(r.status),
    }),
    toServer: (p) =>
      defined({ employeeId: p.employee, workedOn: dateOut(p.date), hours: p.hours, reason: p.reason }),
  },

  objectives: {
    path: "/objectives",
    permission: "performance:read",
    fromServer: (r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? "",
      type: r.kind ?? "Team",
      owner: r.employeeId ?? undefined,
      ownerName: r.employee?.name ?? "",
      priority: r.priority ?? "Medium",
      checkin: r.checkinCadence ?? "Monthly",
      start: day(r.periodStart),
      end: day(r.periodEnd),
      // Computed from the key results underneath it.
      progress: r.progress ?? 0,
    }),
    toServer: (p) =>
      defined({
        title: p.title,
        description: p.description,
        kind: p.type,
        employeeId: p.owner,
        priority: p.priority,
        checkinCadence: p.checkin,
        periodStart: dateOut(p.start),
        periodEnd: dateOut(p.end),
      }),
  },

  keyResults: {
    path: "/key-results",
    permission: "performance:read",
    fromServer: (r) => ({
      id: r.id,
      objectiveId: r.objectiveId,
      title: r.title,
      target: num(r.target),
      current: num(r.current),
      unit: r.unit ?? "",
      progress: num(r.target) > 0 ? Math.round((num(r.current) / num(r.target)) * 100) : 0,
    }),
    toServer: (p) =>
      defined({
        objectiveId: p.objectiveId,
        title: p.title,
        target: p.target,
        // The board edits a percentage; store it against a 100-point target.
        current: p.current ?? (p.progress != null ? p.progress : undefined),
        unit: p.unit,
      }),
  },

  meetings: {
    path: "/review-meetings",
    permission: "performance:read",
    fromServer: (r) => ({
      id: r.id,
      forEmp: r.employeeId,
      forName: r.employee?.name ?? "",
      by: asEmployee(r.heldById),
      date: day(r.scheduledAt),
      time: clock(r.scheduledAt),
      duration: r.durationMins ?? 30,
      status: r.status ?? "Upcoming",
      agenda: r.agenda ?? "",
      notes: r.notes ?? "",
      month: new Date(r.scheduledAt).toLocaleDateString(undefined, { month: "long" }),
    }),
    toServer: (p) =>
      defined({
        employeeId: p.forEmp,
        scheduledAt: p.date && p.time ? new Date(`${p.date} ${p.time}`).toISOString() : undefined,
        durationMins: p.duration,
        agenda: p.agenda,
        notes: p.notes,
        status: p.status,
      }),
  },

  awards: {
    path: "/awards",
    permission: "performance:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon ?? "🏆",
      summary: r.summary ?? "",
      given: r._count?.appreciations ?? 0,
    }),
    toServer: (p) => defined({ name: p.name, icon: p.icon, summary: p.summary }),
  },

  appreciations: {
    path: "/appreciations",
    appendOnly: true,
    permission: "performance:read",
    fromServer: (r) => ({
      id: r.id,
      award: r.award?.name ?? "",
      awardId: r.awardId ?? undefined,
      photo: r.award?.icon ?? "🏆",
      employee: r.employeeId,
      employeeName: r.employee?.name ?? "",
      givenBy: asEmployee(r.givenById),
      date: day(r.awardedOn),
      note: r.note ?? "",
    }),
    toServer: (p) =>
      defined({ employeeId: p.employee, awardId: p.awardId, awardedOn: dateOut(p.date), note: p.note }),
  },

  emergencyContacts: {
    path: "/emergency-contacts",
    permission: "employees:read",
    fromServer: (r) => ({
      id: r.id,
      employee: r.employeeId,
      name: r.name,
      relation: r.relation ?? "",
      phone: r.phone,
    }),
    toServer: (p) =>
      defined({
        employeeId: p.employee,
        name: p.name,
        relation: p.relation,
        phone: p.phone,
      }),
  },

  documents: {
    path: "/employee-documents",
    appendOnly: true,
    permission: "employees:read",
    fromServer: (r) => ({
      id: r.id,
      employee: r.employeeId,
      employeeName: r.employee?.name ?? "",
      name: r.name,
      category: r.category ?? "",
      fileId: r.fileId ?? undefined,
      size: r.file?.sizeBytes ? `${Math.round(r.file.sizeBytes / 1024)} KB` : "—",
      date: r.issuedOn ? day(r.issuedOn) : day(r.createdAt),
    }),
    toServer: (p) =>
      defined({
        employeeId: p.employee,
        name: p.name,
        category: p.category,
        fileId: p.fileId,
        issuedOn: dateOut(p.date),
      }),
  },

  leaveQuota: {
    path: "/leave/balances",
    permission: "leave:read",
    bare: true,
    fromServer: (r) => ({
      id: r.id,
      employee: r.employeeId,
      employeeName: r.employeeName ?? "",
      leaveTypeId: r.leaveTypeId,
      type: r.name ?? "",
      total: num(r.quota),
      taken: num(r.used),
      pending: num(r.pending),
      remaining: num(r.remaining),
    }),
    readOnly: true, // balances move when leave is approved, not by hand
  },

  /* ------------------------------------------------------------- work */

  contracts: {
    path: "/contracts",
    permission: "contracts:read",
    fromServer: (r) => ({
      id: r.id,
      number: r.number,
      subject: r.title,
      type: r.kind ?? "",
      clientId: r.clientId ?? undefined,
      client: r.client?.company ?? "",
      projectId: r.projectId ?? undefined,
      amount: num(r.value),
      start: day(r.startsOn),
      end: day(r.endsOn),
      status: r.status ?? "Draft",
      signed: Boolean(r.signedAt),
    }),
    toServer: (p) =>
      defined({
        title: p.subject,
        number: p.number,
        kind: p.type,
        clientId: p.clientId,
        projectId: p.projectId,
        value: p.amount,
        startsOn: dateOut(p.start),
        endsOn: dateOut(p.end),
        status: p.status,
      }),
  },

  discussions: {
    path: "/discussions",
    permission: "projects:read",
    fromServer: (r) => ({
      id: r.id,
      projectId: r.projectId,
      project: r.project?.name ?? "",
      title: r.title,
      body: r.body,
      author: asEmployee(r.authorId),
      date: day(r.createdAt),
      replies: r._count?.replies ?? (r.replies?.length ?? 0),
    }),
    toServer: (p) => defined({ projectId: p.projectId, title: p.title, body: p.body }),
  },

  roadmapIdeas: {
    path: "/roadmap",
    permission: "projects:read",
    fromServer: (r) => ({
      id: r.id,
      title: r.title,
      detail: r.detail ?? "",
      category: r.category ?? "",
      status: r.status ?? "Under Review",
      votes: r.votes ?? r._count?.votes ?? 0,
      votedByMe: Boolean(r.votedByMe),
    }),
    toServer: (p) =>
      defined({ title: p.title, detail: p.detail, category: p.category, status: p.status }),
  },

  /* --------------------------------------------------------------- IT */

  biolinks: {
    path: "/bio-links",
    permission: "assets:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      url: `bio.worksuite/${r.slug}`,
      slug: r.slug,
      links: Array.isArray(r.links) ? r.links.length : 0,
      clicks: r.clicks ?? 0,
      status: r.status ?? "Active",
    }),
    toServer: (p) => defined({ name: p.name, slug: p.slug, status: p.status }),
  },

  qrCodes: {
    path: "/qr-codes",
    permission: "assets:read",
    fromServer: (r) => ({
      id: r.id,
      title: r.title,
      type: r.kind ?? "URL",
      payload: r.payload,
      color: r.color ?? "#5b5ceb",
      scans: r.scans ?? 0,
      created: day(r.createdAt),
    }),
    toServer: (p) =>
      defined({ title: p.title, kind: p.type, payload: p.payload, color: p.color }),
  },

  webhooks: {
    path: "/webhooks",
    permission: "settings:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      events: r.events ?? [],
      // The secret itself never leaves the server — only whether one is set.
      hasSecret: Boolean(r.hasSecret),
      status: r.status ?? "Active",
      lastFired: r.lastFiredAt ? day(r.lastFiredAt) : null,
    }),
    toServer: (p) =>
      defined({
        name: p.name,
        url: p.url,
        events: p.events,
        secret: p.secret,
        status: p.status,
      }),
  },

  hostings: {
    path: "/hostings",
    permission: "assets:read",
    fromServer: (r) => ({
      id: r.id,
      title: r.title,
      provider: r.provider ?? "—",
      type: r.plan ?? "—",
      clientId: r.clientId ?? undefined,
      client: r.client?.company ?? "—",
      status: r.status ?? "Active",
      purchased: day(r.purchasedOn),
      expiry: day(r.expiresOn),
      cost: num(r.cost),
      domains: r._count?.domains ?? 0,
    }),
    toServer: (p) =>
      defined({
        title: p.title,
        provider: p.provider === "—" ? undefined : p.provider,
        plan: p.type === "—" ? undefined : p.type,
        clientId: p.clientId,
        status: p.status,
        purchasedOn: dateOut(p.purchased),
        expiresOn: dateOut(p.expiry),
        cost: p.cost,
      }),
  },

  domains: {
    path: "/domains",
    permission: "assets:read",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      provider: r.provider ?? "—",
      type: r.kind ?? "—",
      clientId: r.clientId ?? undefined,
      client: r.client?.company ?? "—",
      hostingId: r.hostingId ?? undefined,
      hosting: r.hosting?.title ?? "—",
      status: r.status ?? "Active",
      purchased: day(r.purchasedOn),
      expiry: day(r.expiresOn),
    }),
    toServer: (p) =>
      defined({
        name: p.name,
        provider: p.provider === "—" ? undefined : p.provider,
        kind: p.type === "—" ? undefined : p.type,
        clientId: p.clientId,
        hostingId: p.hostingId,
        status: p.status,
        purchasedOn: dateOut(p.purchased),
        expiresOn: dateOut(p.expiry),
      }),
  },

  biometricDevices: {
    path: "/biometric-devices",
    permission: "attendance:update",
    fromServer: (r) => ({
      id: r.id,
      name: r.name,
      serial: r.serialNumber,
      location: r.location ?? "",
      status: r.status ?? "Offline",
      lastSync: r.lastSyncAt ? `${day(r.lastSyncAt)} ${clock(r.lastSyncAt)}` : "—",
      punches: r._count?.punches ?? 0,
    }),
    toServer: (p) =>
      defined({
        name: p.name,
        serialNumber: p.serial,
        location: p.location,
        status: p.status,
      }),
  },

  biometricLogs: {
    path: "/biometric-punches",
    appendOnly: true,
    permission: "attendance:update",
    fromServer: (r) => ({
      id: r.id,
      employee: r.employeeId ?? undefined,
      employeeName: r.employee?.name ?? "Unmatched",
      device: r.device?.name ?? "",
      deviceId: r.deviceId,
      type: r.direction === "IN" ? "Clock In" : "Clock Out",
      time: `${day(r.punchedAt)} ${clock(r.punchedAt)}`,
    }),
    toServer: (p) =>
      defined({
        deviceId: p.deviceId,
        employeeId: p.employee,
        direction: p.type === "Clock In" ? "IN" : "OUT",
        punchedAt: p.time ? new Date(p.time).toISOString() : undefined,
      }),
  },

  /* ---------------------------------------------------- virtual office */

  floors: {
    path: "/floors",
    permission: "meetings:read",
    fromServer: (r) => ({ id: r.id, name: r.name, position: r.position ?? 0 }),
    toServer: (p) => defined({ name: p.name, position: p.position }),
  },

  officeRooms: {
    path: "/office-rooms",
    permission: "meetings:read",
    bare: true,
    fromServer: (r) => ({
      id: r.slug,
      roomId: r.id,
      floorId: r.floorId,
      name: r.name,
      type: r.kind ?? "work",
      icon: r.icon ?? "💼",
      capacity: r.capacity ?? 8,
      // Live, from presence — not a stored number.
      occupants: (r.occupants ?? []).map(asEmployee).filter(Boolean),
    }),
    toServer: (p) =>
      defined({
        floorId: p.floorId,
        name: p.name,
        kind: p.type,
        icon: p.icon,
        capacity: p.capacity,
      }),
  },

  teamMeetings: {
    path: "/team-meetings",
    permission: "meetings:read",
    fromServer: (r) => ({
      id: r.id,
      title: r.title,
      roomId: r.roomKey,
      projectId: r.projectId ?? undefined,
      project: r.project?.name ?? "",
      organizer: asEmployee(r.organizerId),
      attendees: (r.attendees ?? []).map((a: Row) => asEmployee(a.userId)).filter(Boolean),
      date: day(r.startsAt),
      time: clock(r.startsAt),
      duration: `${r.durationMins ?? 30} min`,
      ended: Boolean(r.endedAt),
      recordings: r._count?.recordings ?? 0,
    }),
    toServer: (p) =>
      defined({
        title: p.title,
        startsAt: p.date && p.time ? new Date(`${p.date} ${p.time}`).toISOString() : undefined,
        durationMins: typeof p.duration === "string" ? parseInt(p.duration, 10) : p.duration,
        projectId: p.projectId,
        attendeeIds: Array.isArray(p.attendees)
          ? p.attendees.map(asUser).filter(Boolean)
          : undefined,
      }),
  },

  recordings: {
    path: "/recordings",
    permission: "meetings:read",
    fromServer: (r) => ({
      id: r.id,
      title: r.title,
      roomId: r.roomKey,
      meetingId: r.meetingId ?? undefined,
      by: asEmployee(r.recordedById),
      size: r.sizeBytes ?? 0,
      duration: r.durationSecs ?? 0,
      date: day(r.createdAt),
      url: `/api/v1/files/${r.id}/download`,
    }),
    readOnly: true, // registered against an uploaded file, not created inline
  },

  /* -------------------------------------------------- flat read views */

  clientContacts: {
    path: "/client-contacts",
    permission: "clients:read",
    fromServer: (r) => ({
      id: r.id,
      clientId: r.clientId,
      client: r.client?.company ?? "",
      name: r.name,
      email: r.email ?? "",
      phone: r.phone ?? "",
      role: r.role ?? "",
      // Same field, under the name the contacts table renders.
      title: r.role ?? "",
      primary: Boolean(r.isPrimary),
    }),
    // Contacts are written through their client — see /clients/:id/contacts.
    readOnly: true,
  },

  leadNotes: {
    path: "/lead-notes",
    permission: "leads:read",
    fromServer: (r) => ({
      id: r.id,
      leadId: r.leadId,
      lead: r.lead?.name ?? "",
      note: r.body ?? "",
      body: r.body ?? "",
      // A note has no separate title on the server, so head it with its first
      // line rather than rendering an empty heading.
      title: String(r.body ?? "").split("\n")[0].slice(0, 80) || "Note",
      by: asEmployee(r.authorId),
      date: day(r.createdAt),
    }),
    readOnly: true, // written through /leads/:id/notes
  },

  projectFiles: {
    path: "/files",
    permission: "projects:read",
    query: { ownerType: "project" },
    fromServer: (r) => ({
      id: r.id,
      projectId: r.ownerId ?? undefined,
      name: r.fileName,
      size: r.sizeBytes ? `${Math.round(r.sizeBytes / 1024)} KB` : "—",
      mime: r.mimeType ?? "",
      by: asEmployee(r.uploadedById),
      date: day(r.createdAt),
      url: `/files/${r.id}/download`,
    }),
    // Files arrive through the upload endpoint, which needs multipart.
    readOnly: true,
  },

  /**
   * The audit trail, for the page that browses it.
   *
   * Marked `skipHydrate` because it is only ever read a page at a time — the
   * recent-activity cache that record panels use is loaded separately.
   */
  audit: {
    path: "/audit",
    permission: "audit:read",
    skipHydrate: true,
    readOnly: true,
    fromServer: (r) => ({
      id: r.id,
      action: String(r.action ?? "").toLowerCase(),
      entity: r.entity ?? "",
      collection: String(r.entity ?? "").toLowerCase(),
      recordId: r.entityId ?? "",
      summary: r.summary ?? "",
      by: r.actor?.name ?? "System",
      at: r.createdAt,
      when: `${day(r.createdAt)} ${clock(r.createdAt)}`,
    }),
  },

  funnel: {
    path: "/jobs/funnel",
    permission: "jobs:read",
    bare: true,
    fromServer: (r) => ({
      id: r.jobId,
      job: r.job,
      total: r.total ?? 0,
      applied: r.APPLIED ?? 0,
      phone: r.PHONE_SCREEN ?? 0,
      interview: r.INTERVIEW ?? 0,
      hired: r.HIRED ?? 0,
      rejected: r.REJECTED ?? 0,
    }),
    readOnly: true, // an aggregate, not a table
  },
};

/** "3 minutes ago" for the notification list. */
function relative(iso: unknown): string {
  const t = new Date(String(iso ?? "")).getTime();
  if (!Number.isFinite(t)) return "";
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** Collections with an endpoint. Everything else runs on local seed data. */
export const backedCollections = Object.keys(ADAPTERS);
