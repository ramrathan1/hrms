export type Employee = {
  id: string;
  /** The human-readable staff number ("E5"); `id` is a database key. */
  code?: string;
  name: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  status: "Active" | "Inactive";
  joined: string;
  reportsTo?: string;
  hourly: number;
};

export const employees: Employee[] = [
  { id: "e1", name: "Mohammed Ziemann", designation: "Team Lead", department: "Engineering", email: "mohammed@worksuite.demo", phone: "1-689-677-5414", status: "Active", joined: "2023-02-14", hourly: 90 },
  { id: "e2", name: "Lila Lueilwitz", designation: "Senior Developer", department: "Engineering", email: "lila@worksuite.demo", phone: "1-601-535-7806", status: "Active", joined: "2023-06-01", reportsTo: "e1", hourly: 78 },
  { id: "e3", name: "Alden Glover", designation: "Project Manager", department: "Delivery", email: "alden@worksuite.demo", phone: "1-228-899-0924", status: "Active", joined: "2022-11-20", hourly: 84 },
  { id: "e4", name: "Kole Johnston", designation: "Junior Developer", department: "Engineering", email: "kole@worksuite.demo", phone: "1-719-710-6682", status: "Active", joined: "2024-01-09", reportsTo: "e2", hourly: 45 },
  { id: "e5", name: "Zane Stroman", designation: "Trainee", department: "Engineering", email: "zane@worksuite.demo", phone: "1-260-218-9633", status: "Active", joined: "2025-03-17", reportsTo: "e2", hourly: 28 },
  { id: "e6", name: "Naomi Rempel", designation: "Junior Designer", department: "Design", email: "naomi@worksuite.demo", phone: "1-848-815-6477", status: "Active", joined: "2024-05-02", reportsTo: "e3", hourly: 40 },
  { id: "e7", name: "Charles Jast", designation: "Project Manager", department: "Delivery", email: "charles@worksuite.demo", phone: "1-463-555-2488", status: "Active", joined: "2022-08-15", hourly: 82 },
  { id: "e8", name: "Zola Douglas", designation: "Trainee", department: "Design", email: "zola@worksuite.demo", phone: "1-228-311-7702", status: "Active", joined: "2025-06-10", reportsTo: "e6", hourly: 26 },
  { id: "e9", name: "Conrad Johnston", designation: "QA Engineer", department: "Engineering", email: "conrad@worksuite.demo", phone: "1-719-004-1123", status: "Active", joined: "2023-09-27", reportsTo: "e1", hourly: 55 },
  { id: "e10", name: "Charley Marquardt", designation: "Recruiter", department: "Human Resource", email: "charley@worksuite.demo", phone: "1-455-220-8871", status: "Active", joined: "2023-12-04", hourly: 42 },
];

export const byId = (id?: string) => employees.find((e) => e.id === id);

export const departments = [
  { id: "d1", name: "Engineering", parent: null, members: 5 },
  { id: "d2", name: "Design", parent: null, members: 2 },
  { id: "d3", name: "Delivery", parent: null, members: 2 },
  { id: "d4", name: "Human Resource", parent: null, members: 1 },
  { id: "d5", name: "Frontend Guild", parent: "Engineering", members: 3 },
  { id: "d6", name: "QA", parent: "Engineering", members: 1 },
];

export const designations = [
  { id: "g1", name: "Team Lead", parent: null },
  { id: "g2", name: "Project Manager", parent: null },
  { id: "g3", name: "Senior Developer", parent: "Team Lead" },
  { id: "g4", name: "Junior Developer", parent: "Senior Developer" },
  { id: "g5", name: "QA Engineer", parent: "Team Lead" },
  { id: "g6", name: "Junior Designer", parent: "Project Manager" },
  { id: "g7", name: "Trainee", parent: "Junior Developer" },
  { id: "g8", name: "Recruiter", parent: null },
];

export type Client = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  category: string;
  added: string;
  status: "Active" | "Inactive";
};

export const clients: Client[] = [
  { id: "c1", name: "Joshua Heller", company: "Heller Group", email: "joshua@hellergroup.com", phone: "1-330-778-0091", category: "Enterprise", added: "2026-01-12", status: "Active" },
  { id: "c2", name: "Vernice Rohan", company: "Bode Group", email: "vernice@bodegroup.com", phone: "1-707-541-8820", category: "SMB", added: "2026-02-03", status: "Active" },
  { id: "c3", name: "Arnaldo Leannon", company: "Moore Ltd", email: "arnaldo@mooreltd.com", phone: "1-215-660-1178", category: "Enterprise", added: "2026-02-25", status: "Active" },
  { id: "c4", name: "Aleen Miller", company: "Kihn-Schaden", email: "aleen@kihnschaden.io", phone: "1-916-483-2210", category: "Agency", added: "2026-03-14", status: "Active" },
  { id: "c5", name: "Jalon Cronin", company: "Hagenes, Mann and Karl", email: "jalon@hmk.co", phone: "1-402-991-3345", category: "SMB", added: "2026-04-02", status: "Active" },
  { id: "c6", name: "Stone Langworth", company: "Gerlach, Stehr and Kunze", email: "stone@gsk.agency", phone: "1-828-772-5567", category: "Agency", added: "2026-04-28", status: "Active" },
  { id: "c7", name: "Kole Windler", company: "Windler LLC", email: "kole@windler.com", phone: "1-919-267-0034", category: "SMB", added: "2026-05-19", status: "Inactive" },
  { id: "c8", name: "Vincenzo Terry", company: "Ryan PLC", email: "vincenzo@ryanplc.com", phone: "1-512-380-4479", category: "Enterprise", added: "2026-06-08", status: "Active" },
  { id: "c9", name: "Candace Sanford", company: "Sanford Studio", email: "candace@sanford.studio", phone: "1-206-441-9083", category: "Agency", added: "2026-07-01", status: "Active" },
  { id: "c10", name: "Kole Johnston Sr.", company: "Johnston & Co", email: "kole@johnstonco.com", phone: "1-701-233-5121", category: "SMB", added: "2026-07-22", status: "Active" },
];

export const clientById = (id?: string) => clients.find((c) => c.id === id);

export const clientContacts = [
  { id: "cc1", clientId: "c1", name: "Maria Heller", email: "maria@hellergroup.com", phone: "1-330-778-0092", title: "CFO" },
  { id: "cc2", clientId: "c1", name: "Devon Ross", email: "devon@hellergroup.com", phone: "1-330-778-0093", title: "Ops Manager" },
  { id: "cc3", clientId: "c2", name: "Pia Bode", email: "pia@bodegroup.com", phone: "1-707-541-8821", title: "Founder" },
  { id: "cc4", clientId: "c4", name: "Ken Schaden", email: "ken@kihnschaden.io", phone: "1-916-483-2211", title: "CTO" },
];
