/**
 * The permission catalogue and the system roles that bundle it.
 *
 * The frontend carried two disagreeing permission systems: route prefix
 * allow-lists in roles.ts, and a module × action matrix in Settings. Neither
 * read the other. This file reconciles them — the matrix wins, because
 * module:action is the granularity writes actually need, and the route
 * allow-lists are reproduced as role bundles on top of it.
 */

export interface PermissionSeed {
  key: string;
  module: string;
  action: string;
  description: string;
}

const ACTIONS = ['read', 'create', 'update', 'delete'] as const;

/** Modules that get the standard four actions. */
const CRUD_MODULES: Array<{ module: string; label: string }> = [
  { module: 'clients', label: 'Clients' },
  { module: 'leads', label: 'Leads' },
  { module: 'deals', label: 'Deals' },
  { module: 'projects', label: 'Projects' },
  { module: 'tasks', label: 'Tasks' },
  { module: 'milestones', label: 'Milestones' },
  { module: 'timelogs', label: 'Time logs' },
  { module: 'contracts', label: 'Contracts' },
  { module: 'invoices', label: 'Invoices' },
  { module: 'estimates', label: 'Estimates' },
  { module: 'payments', label: 'Payments' },
  { module: 'expenses', label: 'Expenses' },
  { module: 'employees', label: 'Employees' },
  { module: 'departments', label: 'Departments' },
  { module: 'attendance', label: 'Attendance' },
  { module: 'leave', label: 'Leave' },
  { module: 'payroll', label: 'Payroll' },
  { module: 'performance', label: 'Performance' },
  { module: 'jobs', label: 'Jobs' },
  { module: 'applications', label: 'Applications' },
  { module: 'interviews', label: 'Interviews' },
  { module: 'offers', label: 'Offers' },
  { module: 'tickets', label: 'Tickets' },
  { module: 'assets', label: 'Assets' },
  { module: 'events', label: 'Events' },
  { module: 'notices', label: 'Notices' },
  { module: 'knowledge', label: 'Knowledge base' },
  { module: 'letters', label: 'Letters' },
  { module: 'channels', label: 'Channels' },
  { module: 'meetings', label: 'Meetings' },
  { module: 'reports', label: 'Reports' },
  { module: 'settings', label: 'Settings' },
  { module: 'roles', label: 'Roles & permissions' },
  { module: 'users', label: 'Users' },
];

/**
 * Actions that are not CRUD. These exist because the UI offers an operation
 * whose authority is different from plain editing — approving leave is not the
 * same right as editing a leave request.
 */
const SPECIAL_PERMISSIONS: PermissionSeed[] = [
  { key: 'invoices:send', module: 'invoices', action: 'send', description: 'Email an invoice to a client' },
  { key: 'payments:refund', module: 'payments', action: 'refund', description: 'Refund a recorded payment' },
  { key: 'leave:approve', module: 'leave', action: 'approve', description: 'Approve or reject leave requests' },
  { key: 'expenses:approve', module: 'expenses', action: 'approve', description: 'Approve or reject expense claims' },
  { key: 'offers:accept', module: 'offers', action: 'accept', description: 'Record an offer acceptance and create the employee' },
  { key: 'leads:convert', module: 'leads', action: 'convert', description: 'Convert a lead into a client' },
  { key: 'attendance:clock', module: 'attendance', action: 'clock', description: 'Clock yourself in and out' },
  { key: 'audit:read', module: 'audit', action: 'read', description: 'Read the audit trail' },
  { key: 'reports:export', module: 'reports', action: 'export', description: 'Export report data' },
  { key: 'mail:manage', module: 'mail', action: 'manage', description: 'Connect and manage mail accounts' },
  { key: 'portal:client', module: 'portal', action: 'client', description: 'Access the client portal' },

  /* Whose records you may read. A module permission says which screen you may
     open; it cannot say whose data belongs on it. Without these, an employee
     and their manager both hold `attendance:read` and both see the whole
     company. See common/self-scope.ts. */
  { key: 'people:all', module: 'people', action: 'all', description: "Read every person's records, not only your own" },
  { key: 'people:team', module: 'people', action: 'team', description: "Read your own records and your direct reports'" },
];

export const SYSTEM_PERMISSIONS: PermissionSeed[] = [
  ...CRUD_MODULES.flatMap(({ module, label }) =>
    ACTIONS.map((action) => ({
      key: `${module}:${action}`,
      module,
      action,
      description: `${actionVerb(action)} ${label.toLowerCase()}`,
    })),
  ),
  ...SPECIAL_PERMISSIONS,
];

export interface RoleSeed {
  key: string;
  name: string;
  description: string;
  /** Supports "*" and "module:*". */
  permissions: string[];
}

/**
 * Role bundles. These reproduce the scoping the frontend already ships:
 * an Accountant reaches finance but not people admin, a Team Leader runs a
 * board but never sees payroll, and so on.
 */
export const SYSTEM_ROLES: RoleSeed[] = [
  {
    key: 'OWNER',
    name: 'Owner',
    description: 'Full access to everything in the organization.',
    permissions: ['*'],
  },
  {
    key: 'MANAGER',
    name: 'Manager',
    description: 'Delivery across projects, clients and the people on them.',
    permissions: [
      'clients:*', 'leads:*', 'deals:*', 'projects:*', 'tasks:*', 'milestones:*',
      'timelogs:*', 'contracts:*', 'tickets:*', 'events:*', 'notices:*',
      'knowledge:*', 'performance:*', 'jobs:*', 'applications:*', 'interviews:*',
      'employees:read', 'departments:read', 'attendance:read', 'attendance:clock',
      'leave:read', 'leave:approve', 'reports:read', 'channels:*', 'meetings:*',
      'mail:manage', 'people:all',
    ],
  },
  {
    key: 'TEAM_LEADER',
    name: 'Team Leader',
    description: "Runs one team's board, workload and approvals.",
    permissions: [
      'projects:read', 'projects:update', 'tasks:*', 'milestones:*', 'timelogs:*',
      'employees:read', 'attendance:read', 'attendance:clock',
      'leave:read', 'leave:approve', 'leave:create',
      'tickets:read', 'tickets:update', 'knowledge:read', 'events:read',
      'notices:read', 'performance:read', 'channels:*', 'meetings:*', 'mail:manage',
      // A team leader's reach is their own team, not the company.
      'people:team',
    ],
  },
  {
    key: 'HR',
    name: 'HR',
    description: 'Hiring, onboarding, attendance, leave and payroll input.',
    permissions: [
      'employees:*', 'departments:*', 'attendance:*', 'leave:*', 'payroll:*',
      'performance:*', 'jobs:*', 'applications:*', 'interviews:*', 'offers:*',
      'letters:*', 'assets:*', 'notices:*', 'events:*', 'knowledge:*',
      'reports:read', 'channels:*', 'meetings:*', 'mail:manage', 'people:all',
    ],
  },
  {
    key: 'ACCOUNTANT',
    name: 'Accountant',
    description: 'Invoicing, payments, expenses and payroll. No people admin.',
    permissions: [
      'invoices:*', 'estimates:*', 'payments:*', 'expenses:*', 'payroll:*',
      'clients:read', 'clients:update', 'projects:read',
      'reports:*', 'knowledge:read', 'channels:read', 'mail:manage',
      'attendance:clock', 'people:all',
    ],
  },
  {
    key: 'EMPLOYEE',
    name: 'Employee',
    description: 'Own work, own time, own leave.',
    permissions: [
      'tasks:read', 'tasks:update', 'timelogs:create', 'timelogs:read', 'timelogs:update',
      'projects:read', 'attendance:read', 'attendance:clock',
      // Not a privilege: without the directory, a task assignee, a chat author
      // and a meeting attendee are all just an id on screen.
      'employees:read', 'departments:read',
      'leave:read', 'leave:create', 'tickets:create', 'tickets:read',
      'knowledge:read', 'events:read', 'notices:read',
      'channels:read', 'channels:create', 'meetings:read', 'mail:manage',
    ],
  },
  {
    key: 'CLIENT',
    name: 'Client',
    description: 'An external customer: their own projects, invoices and tickets.',
    permissions: ['portal:client', 'tickets:create', 'tickets:read', 'knowledge:read'],
  },
];

function actionVerb(action: string): string {
  switch (action) {
    case 'read': return 'View';
    case 'create': return 'Create';
    case 'update': return 'Edit';
    case 'delete': return 'Delete';
    default: return action;
  }
}
