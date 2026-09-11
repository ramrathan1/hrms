import { employees } from "./core";

/* ---------- payroll ---------- */
export const salaries = employees.map((e, i) => ({
  employee: e.id,
  annual: [96000, 84000, 90000, 52000, 30000, 46000, 88000, 28000, 62000, 48000][i],
  cycle: "Monthly",
  updated: "2026-07-01",
}));

export const payslips = employees.map((e, i) => ({
  id: `ps${i + 1}`,
  employee: e.id,
  period: "Aug 2026",
  gross: Math.round([96000, 84000, 90000, 52000, 30000, 46000, 88000, 28000, 62000, 48000][i] / 12),
  deductions: [820, 640, 700, 340, 150, 260, 690, 120, 420, 300][i],
  status: i < 6 ? "Paid" : "Pending",
}));

export const salaryHistory = [
  { id: "sr1", employee: "e2", from: 76000, to: 84000, date: "2026-07-01", note: "Annual review" },
  { id: "sr2", employee: "e4", from: 46000, to: 52000, date: "2026-04-01", note: "Promotion to Junior Developer II" },
  { id: "sr3", employee: "e6", from: 42000, to: 46000, date: "2026-05-01", note: "Annual review" },
];

export const overtimeRequests = [
  { id: "ot1", employee: "e4", date: "2026-08-21", hours: 3, reason: "Release hotfix", status: "Approved" },
  { id: "ot2", employee: "e9", date: "2026-08-25", hours: 2, reason: "Load test window", status: "Pending" },
  { id: "ot3", employee: "e5", date: "2026-08-14", hours: 4, reason: "Data migration", status: "Rejected" },
];

/* ---------- performance ---------- */
export const objectives = [
  { id: "ob1", title: "Ship RBAC overhaul to production", type: "Team", owner: "e1", start: "2026-07-01", end: "2026-09-30", progress: 62, priority: "High", checkin: "Weekly" },
  { id: "ob2", title: "Cut invoice-to-payment time to 5 days", type: "Company", owner: "e3", start: "2026-07-01", end: "2026-12-31", progress: 41, priority: "Medium", checkin: "Monthly" },
  { id: "ob3", title: "Grow qualified pipeline to $150k", type: "Team", owner: "e7", start: "2026-08-01", end: "2026-10-31", progress: 55, priority: "High", checkin: "Weekly" },
  { id: "ob4", title: "Reduce regression escapes by 40%", type: "Individual", owner: "e9", start: "2026-06-15", end: "2026-09-15", progress: 78, priority: "Medium", checkin: "Weekly" },
];

export const keyResults = [
  { id: "kr1", objectiveId: "ob1", title: "Migrate 100% roles to new matrix", progress: 80 },
  { id: "kr2", objectiveId: "ob1", title: "Zero P1 auth incidents for 30 days", progress: 55 },
  { id: "kr3", objectiveId: "ob1", title: "Docs & training complete", progress: 40 },
];

export const meetings = [
  { id: "mt1", forEmp: "e3", by: "e2", date: "2026-08-31", time: "12:30 pm – 01:30 pm", status: "Upcoming", month: "August" },
  { id: "mt2", forEmp: "e3", by: "e2", date: "2026-09-01", time: "12:30 pm – 01:30 pm", status: "Completed", month: "September" },
  { id: "mt3", forEmp: "e4", by: "e1", date: "2026-09-04", time: "10:00 am – 10:30 am", status: "Upcoming", month: "September" },
  { id: "mt4", forEmp: "e6", by: "e3", date: "2026-08-12", time: "03:00 pm – 03:45 pm", status: "Cancelled", month: "August" },
];
