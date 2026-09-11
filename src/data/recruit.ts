export const jobs = [
  { id: "j1", title: "UI/UX Developer", recruiter: "e10", start: "2026-08-29", end: "No End Date", status: "Open", openings: 2, type: "Full Time", location: "Remote" },
  { id: "j2", title: "Designer", recruiter: "e10", start: "2026-08-29", end: "2026-09-08", status: "Open", openings: 1, type: "Full Time", location: "Worksuite HQ" },
  { id: "j3", title: "Software Tester", recruiter: "e10", start: "2026-08-29", end: "2026-09-08", status: "Open", openings: 1, type: "Contract", location: "Remote" },
  { id: "j4", title: "Software Developer", recruiter: "e10", start: "2026-08-29", end: "2026-09-18", status: "Open", openings: 3, type: "Full Time", location: "Worksuite HQ" },
];

export type Application = {
  id: string;
  name: string;
  jobId: string;
  date: string;
  status: "Applied" | "Phone Screen" | "Interview" | "Offer" | "Hired" | "Rejected";
  location: string;
  email: string;
  skills: string[];
  /** Denormalised job title, sent alongside the id. */
  job?: string;
  phone?: string;
  rating?: number | null;
};

export const applications: Application[] = [
  { id: "a1", name: "Leonel Skiles", jobId: "j1", date: "2026-08-29", status: "Hired", location: "Worksuite", email: "leonel@mail.com", skills: ["React", "CSS", "Figma"] },
  { id: "a2", name: "Laurine Auer", jobId: "j2", date: "2026-08-29", status: "Hired", location: "Worksuite", email: "laurine@mail.com", skills: ["Figma", "CSS"] },
  { id: "a3", name: "Nia Kutch", jobId: "j3", date: "2026-08-29", status: "Rejected", location: "Worksuite", email: "nia@mail.com", skills: ["QA", "Selenium"] },
  { id: "a4", name: "Jocelyn Halvorson", jobId: "j3", date: "2026-08-29", status: "Interview", location: "Worksuite", email: "jocelyn@mail.com", skills: ["QA", "API Testing"] },
  { id: "a5", name: "Patrick Goyette", jobId: "j4", date: "2026-08-29", status: "Hired", location: "Worksuite", email: "patrick@mail.com", skills: ["React", "Node", "TypeScript"] },
  { id: "a6", name: "Trace Hoeger", jobId: "j1", date: "2026-08-29", status: "Hired", location: "Worksuite", email: "trace@mail.com", skills: ["React", "CSS"] },
  { id: "a7", name: "Kamille Fritsch", jobId: "j3", date: "2026-08-28", status: "Applied", location: "Worksuite", email: "kamille@mail.com", skills: ["QA", "Cypress"] },
  { id: "a8", name: "Jazmin Fadel", jobId: "j2", date: "2026-08-28", status: "Phone Screen", location: "Worksuite", email: "jazmin@mail.com", skills: ["Figma", "Illustrator"] },
  { id: "a9", name: "Antonina Torphy", jobId: "j3", date: "2026-08-27", status: "Interview", location: "Worksuite", email: "antonina@mail.com", skills: ["QA", "Selenium", "API Testing"] },
  { id: "a10", name: "Savanna Connelly", jobId: "j1", date: "2026-08-27", status: "Applied", location: "Worksuite", email: "savanna@mail.com", skills: ["React", "TypeScript"] },
  { id: "a11", name: "Callie Rowe", jobId: "j1", date: "2026-08-26", status: "Interview", location: "Worksuite", email: "callie@mail.com", skills: ["CSS", "Figma", "React"] },
  { id: "a12", name: "Elmore McLaughlin", jobId: "j3", date: "2026-08-26", status: "Phone Screen", location: "Worksuite", email: "elmore@mail.com", skills: ["QA", "Cypress"] },
];

export const interviews = [
  { id: "iv1", candidate: "Callie Rowe", job: "UI/UX Developer", date: "2026-08-29", time: "09:36 am", status: "Pending" },
  { id: "iv2", candidate: "Leonel Skiles", job: "UI/UX Developer", date: "2026-08-29", time: "06:00 pm", status: "Pending" },
  { id: "iv3", candidate: "Jodie Krajcik", job: "UI/UX Developer", date: "2026-08-29", time: "08:39 pm", status: "Needs Response" },
  { id: "iv4", candidate: "Elmore McLaughlin", job: "Software Tester", date: "2026-08-29", time: "08:57 pm", status: "Pending" },
  { id: "iv5", candidate: "Catharine Prohaska", job: "UI/UX Developer", date: "2026-08-30", time: "10:19 pm", status: "Pending" },
  { id: "iv6", candidate: "Alisha Hoppe", job: "UI/UX Developer", date: "2026-08-30", time: "02:45 am", status: "Pending" },
];

export type Offer = {
  id: string;
  /** Short reference derived from the id; the server has no separate number. */
  offer: string;
  applicationId?: string;
  applicant: string;
  job: string;
  salary: number;
  currency?: string;
  joining: string;
  status: string;
  respondedAt?: string | null;
  employeeId?: string;
};

export const offers: Offer[] = [
  { id: "of1", offer: "Offer-91", job: "Designer", applicant: "Ena Runte", salary: 46000, joining: "2026-09-03", status: "Sent" },
  { id: "of2", offer: "Offer-90", job: "Designer", applicant: "Ellie Nienow", salary: 44000, joining: "2026-09-03", status: "Sent" },
  { id: "of3", offer: "Offer-89", job: "UI/UX Developer", applicant: "Xavier Kris", salary: 58000, joining: "2026-09-03", status: "Accepted" },
  { id: "of4", offer: "Offer-88", job: "Software Developer", applicant: "Ava Jakubowski", salary: 62000, joining: "2026-09-03", status: "Declined" },
];

export const funnel = [
  { job: "Software Developer", total: 23, applied: 7, phone: 7, interview: 3, hired: 5, rejected: 1 },
  { job: "Software Tester", total: 25, applied: 5, phone: 6, interview: 3, hired: 5, rejected: 6 },
  { job: "Designer", total: 18, applied: 2, phone: 4, interview: 4, hired: 4, rejected: 4 },
  { job: "UI/UX developer", total: 25, applied: 7, phone: 3, interview: 2, hired: 6, rejected: 7 },
];
