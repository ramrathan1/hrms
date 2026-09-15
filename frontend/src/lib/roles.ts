/* Roles and what each one can reach.
 *
 * This is navigation, not authorisation. The server decides what a request may
 * actually do — every endpoint is behind a permission check, and a role that
 * slipped past this list would still be refused there. What these definitions
 * shape is the product: each role gets its own landing screen and a sidebar cut
 * down to the work it does, which is the difference between an admin app and a
 * tool an accountant or a trainee wants to open.
 *
 * `allow` is a list of route prefixes. A role sees a nav item, and may open a
 * route, when one of its prefixes matches. The role itself comes from
 * `/auth/me` — see `roleIdFromKeys`.
 */

export type RoleId =
  | "owner"
  | "manager"
  | "team-leader"
  | "hr"
  | "accountant"
  | "employee"
  | "client";

export type RoleDef = {
  id: RoleId;
  label: string;
  /** One line explaining who this is, shown in the switcher. */
  blurb: string;
  /** Where this role lands after signing in. */
  home: string;
  /** Route prefixes this role may open. `["*"]` means everything. */
  allow: string[];
  accent: string;
};

export const ROLES: RoleDef[] = [
  {
    id: "owner",
    label: "Owner",
    blurb: "Runs the company. Sees every module, the money and the audit trail.",
    home: "/portal/owner",
    allow: ["*"],
    accent: "#7C5CFF",
  },
  {
    id: "manager",
    label: "Manager",
    blurb: "Owns delivery across projects, clients and the people on them.",
    home: "/portal/manager",
    allow: [
      "/portal/manager", "/profile", "/dashboard", "/calendar", "/approvals", "/mail", "/office", "/meet",
      "/chat", "/leads", "/deals", "/lead-forms", "/clients", "/work", "/roadmap",
      "/hr/employees", "/hr/leaves", "/hr/attendance", "/hr/shifts", "/hr/holidays",
      "/tickets", "/events", "/notices", "/knowledge", "/performance", "/recruit", "/reports",
    ],
    accent: "#4CC3FF",
  },
  {
    id: "team-leader",
    label: "Team Leader",
    blurb: "Runs one team's board, workload and timesheets day to day.",
    home: "/portal/team-leader",
    allow: [
      "/portal/team-leader", "/dashboard", "/calendar", "/approvals", "/mail", "/office", "/meet",
      "/chat", "/work", "/roadmap", "/hr/employees", "/hr/leaves", "/hr/attendance",
      "/tickets", "/knowledge", "/events", "/notices", "/performance",
    ],
    accent: "#1fa971",
  },
  {
    id: "hr",
    label: "HR",
    blurb: "People: hiring, onboarding, attendance, leave and payroll input.",
    home: "/portal/hr",
    allow: [
      "/portal/hr", "/dashboard", "/calendar", "/approvals", "/mail", "/office", "/meet", "/chat",
      "/hr", "/recruit", "/payroll", "/performance", "/letters", "/notices", "/events",
      "/knowledge", "/assets", "/biometric", "/reports",
    ],
    accent: "#e8983c",
  },
  {
    id: "accountant",
    label: "Accountant",
    blurb: "Invoicing, payments, expenses and payroll. No people admin.",
    home: "/portal/accountant",
    allow: [
      "/portal/accountant", "/dashboard", "/calendar", "/approvals", "/mail", "/chat",
      "/finance", "/payroll", "/clients", "/reports", "/knowledge",
    ],
    accent: "#3f9af5",
  },
  {
    id: "employee",
    label: "Employee",
    blurb: "My work, my time, my leave. Nothing company-wide.",
    home: "/portal/me",
    allow: [
      "/portal/me", "/profile", "/calendar", "/mail", "/office", "/meet", "/chat",
      "/work/tasks", "/work/timesheets", "/work/projects",
      "/hr/leaves", "/hr/attendance", "/hr/holidays",
      "/tickets", "/knowledge", "/events", "/notices",
    ],
    accent: "#63647a",
  },
  {
    id: "client",
    label: "Client",
    blurb: "An outside customer: their projects, invoices and tickets only.",
    home: "/portal/client",
    allow: ["/portal/client", "/portal/", "/profile", "/mail", "/tickets", "/knowledge"],
    accent: "#e5554a",
  },
];

export const roleById = (id?: string) => ROLES.find((r) => r.id === id) ?? ROLES[0];

/** The server's role keys, in descending order of reach. */
const KEY_TO_ROLE: Array<[string, RoleId]> = [
  ["OWNER", "owner"],
  ["MANAGER", "manager"],
  ["HR", "hr"],
  ["ACCOUNTANT", "accountant"],
  ["TEAM_LEADER", "team-leader"],
  ["CLIENT", "client"],
  ["EMPLOYEE", "employee"],
];

/**
 * Pick the portal for an account, given the role keys `/auth/me` returned.
 *
 * Someone can hold more than one role. The widest one wins, so a manager who is
 * also an employee lands on the manager portal rather than the personal one.
 */
export function roleIdFromKeys(keys: string[] | undefined): RoleId {
  const held = new Set((keys ?? []).map((k) => k.toUpperCase()));
  for (const [key, role] of KEY_TO_ROLE) if (held.has(key)) return role;
  return "employee";
}

/**
 * Every portal this account may view, widest first.
 *
 * The role switcher offers this list. It used to offer all seven to everyone,
 * so an employee could put the shell into Owner and see a sidebar full of
 * payroll and finance they cannot open — the server refuses each route, but the
 * app should not have offered them in the first place.
 */
export function roleIdsFromKeys(keys: string[] | undefined): RoleId[] {
  const held = new Set((keys ?? []).map((k) => k.toUpperCase()));
  const mine = KEY_TO_ROLE.filter(([key]) => held.has(key)).map(([, role]) => role);
  return mine.length ? mine : ["employee"];
}

/** Map the free-text role stored on an employee record onto a RoleId. */
export function roleIdFromLabel(label?: string): RoleId {
  const l = (label ?? "").toLowerCase();
  if (l.includes("administrator") || l.includes("owner") || l.includes("founder")) return "owner";
  if (l.includes("hr") || l.includes("human resource") || l.includes("recruiter")) return "hr";
  if (l.includes("account") || l.includes("finance")) return "accountant";
  if (l.includes("team lead")) return "team-leader";
  if (l.includes("manager")) return "manager";
  if (l.includes("client")) return "client";
  return "employee";
}

/** Can this role open this path? */
export function canAccess(role: RoleDef, path: string): boolean {
  if (path === "/") return true; // just redirects to the role's own home
  if (role.allow.includes("*")) return true;
  return role.allow.some((prefix) => path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix));
}
