import { employees } from "./core";

export const leaveTypes = ["Casual", "Sick", "Earned"];

export type Leave = {
  id: string;
  /** Employee id. */
  employee: string;
  /** Denormalised name, sent by the API alongside the id. */
  employeeName?: string;
  type: string;
  date: string;
  /** Last day off, when the request spans more than one. */
  endDate?: string;
  days?: number;
  leaveTypeId?: string;
  duration: string;
  status: string;
  reason: string;
};

export const leaves: Leave[] = [
  { id: "lv1", employee: "e2", type: "Casual", date: "2026-08-31", duration: "Full Day", status: "Approved", reason: "Family function" },
  { id: "lv2", employee: "e5", type: "Sick", date: "2026-08-27", duration: "Full Day", status: "Approved", reason: "Fever" },
  { id: "lv3", employee: "e4", type: "Casual", date: "2026-09-03", duration: "First Half", status: "Pending", reason: "Bank work" },
  { id: "lv4", employee: "e8", type: "Earned", date: "2026-09-10", duration: "Full Day", status: "Pending", reason: "Trip" },
  { id: "lv5", employee: "e9", type: "Sick", date: "2026-08-18", duration: "Full Day", status: "Rejected", reason: "—" },
];

export const leaveQuota = employees.map((e) => ({
  employee: e.id,
  total: 30,
  taken: e.id === "e2" ? 4 : e.id === "e5" ? 2 : e.id === "e9" ? 1 : 0,
}));

export const shifts = [
  { id: "sh1", name: "General Shift", start: "09:00", end: "18:00", color: "#5b5ceb" },
  { id: "sh2", name: "Night Shift", start: "21:00", end: "06:00", color: "#4cc3ff" },
  { id: "sh3", name: "Early Shift", start: "06:00", end: "15:00", color: "#1fa971" },
];

export const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();

export const holidays = [
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-08-25", name: "Founders Day" },
  { date: "2026-09-07", name: "Labor Day" },
  { date: "2026-09-16", name: "Mid-Autumn Festival" },
];

export const appreciations = [
  { id: "ap1", award: "Employee of the Month", employee: "e2", date: "2026-08-01", givenBy: "e1", photo: "🏆" },
  { id: "ap2", award: "Best Team Player", employee: "e6", date: "2026-07-15", givenBy: "e3", photo: "🤝" },
  { id: "ap3", award: "Rising Star", employee: "e5", date: "2026-06-30", givenBy: "e1", photo: "⭐" },
];

export const awards = [
  { id: "aw1", name: "Employee of the Month", icon: "🏆", summary: "Outstanding overall contribution", given: 8 },
  { id: "aw2", name: "Best Team Player", icon: "🤝", summary: "Collaboration above and beyond", given: 5 },
  { id: "aw3", name: "Rising Star", icon: "⭐", summary: "Fast growth and initiative", given: 3 },
];

export const emergencyContacts = [
  { id: "ec1", employee: "e1", name: "Amira Ziemann", relation: "Spouse", phone: "1-330-118-6690" },
  { id: "ec2", employee: "e2", name: "Rolf Lueilwitz", relation: "Father", phone: "1-601-577-1204" },
];

export const documents = [
  { id: "dc1", employee: "e1", name: "Offer letter.pdf", date: "2023-02-10" },
  { id: "dc2", employee: "e1", name: "NDA (signed).pdf", date: "2023-02-14" },
  { id: "dc3", employee: "e2", name: "Offer letter.pdf", date: "2023-05-28" },
];
