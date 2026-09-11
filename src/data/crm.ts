export type Lead = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  owner: string; // employee id
  added: string;
};

export const leads: Lead[] = [
  { id: "l1", name: "Garret Botsford", company: "Botsford Media", email: "garret@botsford.media", phone: "1-641-202-8850", source: "Google", owner: "e3", added: "2026-08-02" },
  { id: "l2", name: "Casper Arden", company: "Arden Digital", email: "casper@arden.digital", phone: "1-260-218-9611", source: "Email", owner: "e7", added: "2026-08-05" },
  { id: "l3", name: "Mallie Becker", company: "Becker Foods", email: "mallie@beckerfoods.com", phone: "1-848-815-6412", source: "Facebook", owner: "e3", added: "2026-08-09" },
  { id: "l4", name: "Wyatt Klocko", company: "Klocko Logistics", email: "wyatt@klocko.log", phone: "1-304-544-1117", source: "Direct", owner: "e10", added: "2026-08-11" },
  { id: "l5", name: "Alayna Kemmer", company: "Kemmer Health", email: "alayna@kemmer.health", phone: "1-463-555-2401", source: "Friend", owner: "e7", added: "2026-08-15" },
  { id: "l6", name: "Osborne Swaniawski", company: "Swan Craft", email: "osborne@swancraft.co", phone: "1-520-720-6685", source: "Google", owner: "e3", added: "2026-08-18" },
  { id: "l7", name: "Robin Ebert", company: "Ebert & Sons", email: "robin@ebertsons.com", phone: "1-415-445-6255", source: "Tv", owner: "e10", added: "2026-08-21" },
  { id: "l8", name: "Neal Cummerata", company: "Cummerata Legal", email: "neal@cummerata.law", phone: "1-719-710-6001", source: "Direct", owner: "e7", added: "2026-08-24" },
];

export const pipelineStages = [
  { id: "generated", title: "Generated", color: "#8b94a7" },
  { id: "qualified", title: "Qualified", color: "#3fa9f5" },
  { id: "proposal", title: "Proposal Sent", color: "#e8983c" },
  { id: "negotiation", title: "Negotiation", color: "#5b5ceb" },
  { id: "won", title: "Win", color: "#1fa971" },
  { id: "lost", title: "Lost", color: "#e85d51" },
];

export type Deal = {
  id: string;
  name: string;
  leadId: string;
  value: number;
  stage: string;
  agent: string;
  close: string;
  category: string;
};

export const deals: Deal[] = [
  { id: "dl1", name: "Website revamp", leadId: "l1", value: 12500, stage: "generated", agent: "e3", close: "2026-09-15", category: "Best Case" },
  { id: "dl2", name: "Mobile app build", leadId: "l2", value: 34000, stage: "qualified", agent: "e7", close: "2026-09-30", category: "Commit" },
  { id: "dl3", name: "SEO retainer", leadId: "l3", value: 5400, stage: "proposal", agent: "e3", close: "2026-09-10", category: "Pipeline" },
  { id: "dl4", name: "ERP integration", leadId: "l4", value: 48000, stage: "negotiation", agent: "e10", close: "2026-10-12", category: "Commit" },
  { id: "dl5", name: "Support contract", leadId: "l5", value: 9600, stage: "qualified", agent: "e7", close: "2026-09-22", category: "Best Case" },
  { id: "dl6", name: "Brand refresh", leadId: "l6", value: 7800, stage: "won", agent: "e3", close: "2026-08-20", category: "Closed" },
  { id: "dl7", name: "Data migration", leadId: "l7", value: 15200, stage: "generated", agent: "e10", close: "2026-10-01", category: "Pipeline" },
  { id: "dl8", name: "Hosting bundle", leadId: "l8", value: 3200, stage: "lost", agent: "e7", close: "2026-08-12", category: "Closed" },
];

export const leadForms = [
  { id: "f1", name: "Website Contact Form", created: "2026-05-10", submissions: 42 },
  { id: "f2", name: "Landing Page — Q3 Campaign", created: "2026-07-01", submissions: 18 },
  { id: "f3", name: "Partner Referral Form", created: "2026-08-04", submissions: 6 },
];

export const leadNotes = [
  { id: "n1", leadId: "l1", title: "Intro call summary", date: "2026-08-04", body: "Interested in a full rebuild; budget approval expected mid-September." },
  { id: "n2", leadId: "l1", title: "Pricing sent", date: "2026-08-12", body: "Shared three-tier proposal, follow up next Tuesday." },
];

export const leadEmails = [
  { id: "m1", leadId: "l1", subject: "Proposal — Botsford Media website", date: "2026-08-12", to: "garret@botsford.media" },
  { id: "m2", leadId: "l1", subject: "Re: Kickoff availability", date: "2026-08-19", to: "garret@botsford.media" },
];
