export const tickets = [
  { id: "tkt-012", number: "TKT#012", subject: "Cannot download invoice PDF", requester: "Joshua Heller", agent: "e9", priority: "High", status: "Open", updated: "2026-08-28", group: "Technical", type: "Problem" },
  { id: "tkt-011", number: "TKT#011", subject: "Add new user seat", requester: "Aleen Miller", agent: "e4", priority: "Medium", status: "Pending", updated: "2026-08-27", group: "Billing", type: "Request" },
  { id: "tkt-010", number: "TKT#010", subject: "Report totals mismatch", requester: "Vernice Rohan", agent: "e9", priority: "High", status: "Open", updated: "2026-08-26", group: "Technical", type: "Problem" },
  { id: "tkt-009", number: "TKT#009", subject: "Change billing address", requester: "Jalon Cronin", agent: "e10", priority: "Low", status: "Resolved", updated: "2026-08-24", group: "Billing", type: "Request" },
  { id: "tkt-008", number: "TKT#008", subject: "API rate-limit question", requester: "Stone Langworth", agent: "e2", priority: "Medium", status: "Closed", updated: "2026-08-21", group: "Technical", type: "Question" },
];

export const events = [
  { date: "2026-08-31", title: "Sprint review", color: "#5b5ceb" },
  { date: "2026-09-01", title: "Client demo — RTA", color: "#1fa971" },
  { date: "2026-09-04", title: "Design critique", color: "#5b5ceb" },
  { date: "2026-09-11", title: "All-hands", color: "#e8983c" },
  { date: "2026-08-20", title: "Release v6.1", color: "#e85d51" },
];

export const notices = [
  { id: "nt1", title: "Office closed on Founders Day", to: "Employees", date: "2026-08-22" },
  { id: "nt2", title: "New expense policy from September", to: "Employees", date: "2026-08-18" },
  { id: "nt3", title: "Scheduled maintenance window", to: "Clients", date: "2026-08-10" },
];

export const kbArticles = [
  { id: "kb1", title: "Getting started with projects", category: "Projects", views: 412, updated: "2026-08-05" },
  { id: "kb2", title: "Raising and tracking tickets", category: "Support", views: 288, updated: "2026-07-28" },
  { id: "kb3", title: "Understanding invoice statuses", category: "Billing", views: 190, updated: "2026-08-14" },
  { id: "kb4", title: "Leave application workflow", category: "HR", views: 240, updated: "2026-08-19" },
];

export const assets = [
  { id: "as1", name: 'MacBook Pro 14" — #A102', type: "Laptop", assignedTo: "e2", status: "In Use", date: "2026-01-20", value: 2400 },
  { id: "as2", name: "Dell U2723QE — #M330", type: "Monitor", assignedTo: "e4", status: "In Use", date: "2026-02-11", value: 620 },
  { id: "as3", name: "iPhone 15 — #P077", type: "Phone", assignedTo: "e3", status: "In Use", date: "2025-11-02", value: 990 },
  { id: "as4", name: "ThinkPad X1 — #A088", type: "Laptop", assignedTo: undefined, status: "Available", date: "2025-09-15", value: 1750 },
  { id: "as5", name: "Logitech MX Keys — #K501", type: "Accessory", assignedTo: "e6", status: "In Use", date: "2026-03-08", value: 110 },
];

export const biolinks = [
  { id: "bl1", name: "Worksuite — Official", url: "bio.worksuite/official", clicks: 1240, links: 6, status: "Active" },
  { id: "bl2", name: "Careers", url: "bio.worksuite/careers", clicks: 486, links: 4, status: "Active" },
  { id: "bl3", name: "Support", url: "bio.worksuite/help", clicks: 233, links: 3, status: "Inactive" },
];

export type LetterTemplate = { id: string; name: string; updated: string; body: string };

/* Merge fields resolved at generate time — see MERGE_FIELDS in pages/ops/Letters.tsx. */
export const letterTemplates: LetterTemplate[] = [
  {
    id: "lt1",
    name: "Offer Letter",
    updated: "2026-07-30",
    body: `Dear {{employee_name}},

We are delighted to offer you the position of {{designation}} in our {{department}} team at {{company}}.

Your appointment takes effect from {{joining_date}}. Your annual compensation will be {{salary}}, reviewed each year in line with company policy.

Please sign and return a copy of this letter to confirm your acceptance. We are looking forward to working with you.

Warm regards,
{{company}} · People Team
{{today}}`,
  },
  {
    id: "lt2",
    name: "Experience Certificate",
    updated: "2026-06-12",
    body: `TO WHOM IT MAY CONCERN

This is to certify that {{employee_name}} has been employed with {{company}} as {{designation}} in the {{department}} department since {{joining_date}}.

Throughout this period their conduct and performance have been found to be satisfactory. We wish them every success in their future endeavours.

Issued on {{today}}.

{{company}} · People Team`,
  },
  {
    id: "lt3",
    name: "Increment Letter",
    updated: "2026-08-02",
    body: `Dear {{employee_name}},

In recognition of your contribution as {{designation}}, we are pleased to confirm a revision to your compensation.

With effect from {{today}}, your revised annual compensation will be {{salary}}. All other terms of your employment remain unchanged.

Thank you for the work you continue to do for the {{department}} team.

Sincerely,
{{company}} · People Team`,
  },
  {
    id: "lt4",
    name: "Relieving Letter",
    updated: "2026-05-25",
    body: `Dear {{employee_name}},

This is to confirm that you have been relieved from your duties as {{designation}}, {{department}}, at {{company}} as of {{today}}.

We confirm that all company property has been returned and your dues have been settled. We thank you for your service since {{joining_date}} and wish you well.

Sincerely,
{{company}} · People Team`,
  },
];

export type GeneratedLetter = {
  id: string;
  template: string;
  employee: string;
  date: string;
  body: string;
};

export const generatedLetters: GeneratedLetter[] = [
  {
    id: "gl1",
    template: "Increment Letter",
    employee: "e2",
    date: "2026-08-05",
    body: `Dear Lila Lueilwitz,

In recognition of your contribution as Senior Developer, we are pleased to confirm a revision to your compensation.

With effect from 05-08-2026, your revised annual compensation will be $84,000. All other terms of your employment remain unchanged.

Sincerely,
Worksuite · People Team`,
  },
  {
    id: "gl2",
    template: "Offer Letter",
    employee: "e8",
    date: "2026-06-09",
    body: `Dear Zola Douglas,

We are delighted to offer you the position of Trainee in our Design team at Worksuite.

Your appointment takes effect from 10-06-2025. Your annual compensation will be $28,000.

Warm regards,
Worksuite · People Team`,
  },
];

export const webhooks: { id: number; name: string; url: string; status: string }[] = [];

export const hostings = [
  { id: "h1", title: "DNS Server", provider: "Google Cloud Platform (GCP)", type: "VPS Hosting - SSD", client: "—", status: "Suspended", purchased: "2025-11-24", expiry: "2027-09-29" },
  { id: "h2", title: "Database Server", provider: "GoDaddy", type: "PHP Hosting", client: "—", status: "Suspended", purchased: "2025-02-08", expiry: "2027-05-18" },
  { id: "h3", title: "Backup Server", provider: "Rackspace", type: "Database Hosting", client: "Aleen Miller", status: "Suspended", purchased: "2026-01-13", expiry: "2028-06-07" },
  { id: "h4", title: "API Server", provider: "Akamai", type: "File Storage Hosting", client: "—", status: "Pending", purchased: "2026-03-08", expiry: "2027-08-07" },
  { id: "h5", title: "Load Balancer", provider: "Google Workspace", type: "Edge Computing", client: "Aleen Miller", status: "Pending", purchased: "2025-03-03", expiry: "2026-10-09" },
  { id: "h6", title: "Production Server", provider: "Microsoft 365", type: "Multi-Cloud Hosting", client: "Jalon Cronin", status: "Expired", purchased: "2025-06-07", expiry: "2028-03-18" },
  { id: "h7", title: "CDN Server", provider: "Linode", type: "Staging Hosting", client: "Jalon Cronin", status: "Expired", purchased: "2026-08-22", expiry: "2026-09-06" },
];

export const domains = [
  { id: "dm1", name: "webapp.com", provider: "GoDaddy", type: "DEV", client: "Vernice Rohan", status: "Expired", purchased: "2025-09-13", expiry: "2026-10-08", hosting: "CDN Server" },
  { id: "dm2", name: "webapp.co", provider: "IBM Cloud", type: "DEV", client: "Bertrand Rodriguez", status: "Pending", purchased: "2025-08-02", expiry: "2027-07-24", hosting: "Development Server" },
  { id: "dm3", name: "web.dev", provider: "DreamHost", type: "CO", client: "Aleen Miller", status: "Suspended", purchased: "2025-02-07", expiry: "2027-02-12", hosting: "—" },
  { id: "dm4", name: "tech.org", provider: "SiteGround", type: "COM", client: "—", status: "Suspended", purchased: "2025-02-11", expiry: "2028-08-23", hosting: "Application Server" },
  { id: "dm5", name: "startup.dev", provider: "Linode", type: "COM", client: "Vernice Rohan", status: "Transferring", purchased: "2026-02-17", expiry: "2028-05-27", hosting: "Development Server" },
  { id: "dm6", name: "service.co", provider: "MongoDB Atlas", type: "NET", client: "—", status: "Active", purchased: "2026-06-19", expiry: "2027-11-28", hosting: "Backup Server" },
];

export const biometricDevices = [
  { id: "bd1", name: "HQ Entrance — ZK F18", serial: "ZK-88-1042", location: "Main Door", status: "Online", lastSync: "2026-08-29 09:12 am" },
  { id: "bd2", name: "Floor 2 — ZK MB460", serial: "ZK-88-2210", location: "Engineering", status: "Offline", lastSync: "2026-08-27 06:40 pm" },
];

export const biometricLogs = [
  { id: 1, employee: "e2", device: "HQ Entrance — ZK F18", type: "Clock In", time: "2026-08-29 09:02 am" },
  { id: 2, employee: "e4", device: "HQ Entrance — ZK F18", type: "Clock In", time: "2026-08-29 09:11 am" },
  { id: 3, employee: "e2", device: "HQ Entrance — ZK F18", type: "Clock Out", time: "2026-08-28 06:31 pm" },
  { id: 4, employee: "e9", device: "Floor 2 — ZK MB460", type: "Clock In", time: "2026-08-28 08:55 am" },
];


export const notifications = [
  { id: 1, text: "Lila Lueilwitz logged 4h on DMS-25", time: "12 min ago" },
  { id: 2, text: "INV#017 was sent to Kihn-Schaden", time: "1 hour ago" },
  { id: 3, text: "Leave request from Kole Johnston is pending", time: "3 hours ago" },
  { id: 4, text: "Deal “Brand refresh” marked Won", time: "Yesterday" },
];

export const todos = [
  { id: 1, text: "Review RBAC pull request", done: false },
  { id: 2, text: "Send Q3 invoice batch", done: false },
  { id: 3, text: "Prepare sprint review deck", done: true },
  { id: 4, text: "1-on-1 with Naomi", done: false },
];

/* QR codes — moved here when the Purchase module was removed; these are
   general-purpose codes (WiFi, WhatsApp, location), not purchasing records. */
export const qrCodes = [
  { id: "q1", title: "Support WhatsApp line", type: "WhatsApp", created: "2026-08-29", color: "#1fa971" },
  { id: "q2", title: "Office WiFi access", type: "WiFi", created: "2026-08-29", color: "#e8983c" },
  { id: "q3", title: "HQ location pin", type: "Location", created: "2026-08-28", color: "#4cc3ff" },
  { id: "q4", title: "Sales email", type: "Email", created: "2026-08-27", color: "#5b5ceb" },
  { id: "q5", title: "Careers page", type: "URL", created: "2026-08-26", color: "#5b5ceb" },
  { id: "q6", title: "Front-desk SMS", type: "SMS", created: "2026-08-25", color: "#e85d51" },
];
