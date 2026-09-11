export type Project = {
  id: string;
  code: string;
  name: string;
  clientId: string;
  members: string[];
  start: string;
  deadline: string;
  progress: number;
  status: "In Progress" | "On Hold" | "Completed" | "Not Started";
  budget: number;
  category: string;
};

export const projects: Project[] = [
  { id: "p1", code: "UM", name: "User Management", clientId: "c1", members: ["e1", "e2", "e4"], start: "2026-06-01", deadline: "2026-09-30", progress: 64, status: "In Progress", budget: 42000, category: "Web" },
  { id: "p2", code: "RTA", name: "Railway tracking and arrival time prediction system", clientId: "c2", members: ["e2", "e5", "e9"], start: "2026-05-10", deadline: "2026-10-15", progress: 38, status: "In Progress", budget: 88000, category: "Platform" },
  { id: "p3", code: "DMS", name: "Document management System", clientId: "c3", members: ["e2", "e6"], start: "2026-04-01", deadline: "2026-08-31", progress: 91, status: "In Progress", budget: 36000, category: "Web" },
  { id: "p4", code: "IAS", name: "Inventory and stock management system", clientId: "c4", members: ["e1", "e9"], start: "2026-03-15", deadline: "2026-07-30", progress: 100, status: "Completed", budget: 51000, category: "Platform" },
  { id: "p5", code: "CME", name: "Community management and engagement service", clientId: "c5", members: ["e3", "e6", "e8"], start: "2026-07-01", deadline: "2026-11-20", progress: 18, status: "In Progress", budget: 27000, category: "Service" },
  { id: "p6", code: "FBA", name: "Fingerprint-based ATM system", clientId: "c8", members: ["e1", "e2", "e9"], start: "2026-02-01", deadline: "2026-09-05", progress: 74, status: "On Hold", budget: 96000, category: "Platform" },
  { id: "p7", code: "CRM", name: "Customer relationship portal", clientId: "c6", members: ["e4", "e5"], start: "2026-08-01", deadline: "2026-12-01", progress: 6, status: "Not Started", budget: 30000, category: "Web" },
];

export const projectById = (id?: string) => projects.find((p) => p.id === id);

export type Task = {
  id: string;
  code: string;
  title: string;
  projectId: string;
  assignees: string[];
  due: string;
  status: "Incomplete" | "Todo" | "Doing" | "Completed";
  priority: "High" | "Medium" | "Low";
  label?: string;
  hours: number;
};

export const tasks: Task[] = [
  { id: "t1", code: "UM-1", title: "Design login & session flows", projectId: "p1", assignees: ["e6"], due: "2026-08-03", status: "Completed", priority: "High", label: "design", hours: 12 },
  { id: "t2", code: "UM-2", title: "Role & permission matrix API", projectId: "p1", assignees: ["e2"], due: "2026-05-29", status: "Doing", priority: "High", label: "api", hours: 22 },
  { id: "t3", code: "UM-3", title: "Password policies + 2FA", projectId: "p1", assignees: ["e4"], due: "2026-03-25", status: "Incomplete", priority: "Medium", hours: 9 },
  { id: "t4", code: "UM-4", title: "Audit log viewer", projectId: "p1", assignees: ["e4", "e9"], due: "2026-08-31", status: "Todo", priority: "Medium", hours: 0 },
  { id: "t5", code: "UM-5", title: "Session device management", projectId: "p1", assignees: ["e2"], due: "2026-08-31", status: "Todo", priority: "Low", hours: 0 },
  { id: "t6", code: "RTA-16", title: "Arrival prediction model v2", projectId: "p2", assignees: ["e9"], due: "2026-08-31", status: "Completed", priority: "High", label: "ml", hours: 31 },
  { id: "t7", code: "RTA-17", title: "Station dashboard widgets", projectId: "p2", assignees: ["e5"], due: "2026-08-11", status: "Todo", priority: "High", hours: 4 },
  { id: "t8", code: "RTA-18", title: "GPS ingestion retry queue", projectId: "p2", assignees: ["e2"], due: "2026-08-30", status: "Doing", priority: "Medium", hours: 11 },
  { id: "t9", code: "RTA-19", title: "Alerting for delayed trains", projectId: "p2", assignees: ["e5"], due: "2026-04-09", status: "Incomplete", priority: "High", hours: 2 },
  { id: "t10", code: "RTA-20", title: "Timetable import wizard", projectId: "p2", assignees: ["e4"], due: "2026-09-02", status: "Incomplete", priority: "Medium", hours: 6 },
  { id: "t11", code: "DMS-24", title: "Version-diff viewer", projectId: "p3", assignees: ["e2"], due: "2026-08-27", status: "Doing", priority: "Medium", hours: 14 },
  { id: "t12", code: "DMS-25", title: "OCR pipeline hardening", projectId: "p3", assignees: ["e2"], due: "2026-08-29", status: "Completed", priority: "High", hours: 18 },
  { id: "t13", code: "IAS-15", title: "Stock valuation report", projectId: "p4", assignees: ["e1"], due: "2026-07-25", status: "Completed", priority: "Medium", hours: 8 },
  { id: "t14", code: "CME-3", title: "Moderation queue UI", projectId: "p5", assignees: ["e8"], due: "2026-09-10", status: "Todo", priority: "Medium", hours: 0 },
  { id: "t15", code: "FBA-9", title: "Sensor SDK upgrade", projectId: "p6", assignees: ["e9"], due: "2026-09-01", status: "Doing", priority: "High", hours: 16 },
];

export const milestones = [
  { id: "ms1", projectId: "p1", title: "Auth foundation", cost: 12000, status: "Complete", tasks: 6, due: "2026-07-01" },
  { id: "ms2", projectId: "p1", title: "RBAC & audit", cost: 18000, status: "In Progress", tasks: 5, due: "2026-09-05" },
  { id: "ms3", projectId: "p1", title: "Hardening & launch", cost: 12000, status: "Not Started", tasks: 4, due: "2026-09-28" },
  { id: "ms4", projectId: "p2", title: "Data ingestion", cost: 30000, status: "Complete", tasks: 9, due: "2026-06-20" },
  { id: "ms5", projectId: "p2", title: "Prediction engine", cost: 34000, status: "In Progress", tasks: 7, due: "2026-09-25" },
];

export type TimeLog = {
  id: string;
  taskId: string;
  employee: string;
  start: string;
  end: string;
  hours: number;
  memo: string;
};

export const timeLogs: TimeLog[] = [
  { id: "tl1", taskId: "t12", employee: "e2", start: "2026-08-02 04:54 pm", end: "2026-08-02 06:54 pm", hours: 2, memo: "OCR fixtures" },
  { id: "tl2", taskId: "t12", employee: "e2", start: "2026-08-29 11:30 am", end: "2026-08-29 03:30 pm", hours: 4, memo: "Threshold tuning" },
  { id: "tl3", taskId: "t6", employee: "e9", start: "2026-08-08 03:58 pm", end: "2026-08-08 07:58 pm", hours: 4, memo: "Model evaluation" },
  { id: "tl4", taskId: "t2", employee: "e1", start: "2026-08-29 05:30 am", end: "2026-08-29 07:30 am", hours: 2, memo: "Permission API review" },
  { id: "tl5", taskId: "t7", employee: "e4", start: "2026-08-21 06:59 pm", end: "2026-08-21 10:59 pm", hours: 4, memo: "Widget scaffolding" },
];

export const contracts = [
  { id: "ct1", number: "CONTRACT#001", subject: "UM annual support & maintenance", clientId: "c1", amount: 24000, start: "2026-01-01", end: "2026-12-31", type: "Support", signed: true },
  { id: "ct2", number: "CONTRACT#002", subject: "RTA platform build — fixed bid", clientId: "c2", amount: 88000, start: "2026-05-10", end: "2026-10-15", type: "Development", signed: true },
  { id: "ct3", number: "CONTRACT#003", subject: "Design retainer", clientId: "c9", amount: 4500, start: "2026-08-01", end: "2027-01-31", type: "Retainer", signed: false },
];

export const roadmapIdeas = [
  { id: "r1", title: "Dark mode across client portal", votes: 48, status: "In Progress", category: "UI" },
  { id: "r2", title: "Slack notifications for invoice payments", votes: 36, status: "Planned", category: "Integrations" },
  { id: "r3", title: "Custom report builder", votes: 74, status: "Under Review", category: "Reports" },
  { id: "r4", title: "Offline time tracking", votes: 22, status: "Planned", category: "Timesheet" },
  { id: "r5", title: "Client-side file approvals", votes: 51, status: "Shipped", category: "Files" },
];

export const discussions = [
  { id: "ds1", projectId: "p1", author: "e3", date: "2026-08-20", title: "Scope for RBAC phase", replies: 4 },
  { id: "ds2", projectId: "p1", author: "e2", date: "2026-08-26", title: "Audit log retention policy", replies: 2 },
];

export const projectFiles = [
  { id: "pf1", projectId: "p1", name: "auth-flows-v3.fig", size: "4.2 MB", by: "e6", date: "2026-08-11" },
  { id: "pf2", projectId: "p1", name: "rbac-matrix.xlsx", size: "84 KB", by: "e2", date: "2026-08-18" },
  { id: "pf3", projectId: "p1", name: "kickoff-notes.pdf", size: "212 KB", by: "e3", date: "2026-06-02" },
];
