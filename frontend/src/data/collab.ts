/* Communication (Slack-style), Virtual Office, and Meet (Teams-style) seed data. */

export type Channel = {
  id: string;
  name: string;
  desc: string;
  private?: boolean;
  group?: boolean;
  members?: string[];
};

export const channels: Channel[] = [
  { id: "general", name: "general", desc: "Company-wide chatter & wins" },
  { id: "announcements", name: "announcements", desc: "Official announcements only" },
  { id: "engineering", name: "engineering", desc: "Builds, deploys, code review" },
  { id: "design", name: "design", desc: "Critique, tokens, handoffs" },
  { id: "delivery", name: "delivery", desc: "Client projects & timelines" },
  { id: "sales", name: "sales", desc: "Pipeline, deals, wins", private: true },
];

export type ChannelMessage = {
  id: string;
  channelId: string;
  threadId: string | null;
  userId: string;
  name: string;
  text: string;
  time: string;
  reactions: Record<string, number>;
};

export const channelMessages: ChannelMessage[] = [
  { id: "cm1", channelId: "general", threadId: null, userId: "e3", name: "Alden Glover", text: "Welcome to the new workspace everyone 🎉 Channels replace the old inbox — keep project talk in #delivery.", time: "2026-08-29T08:10:00Z", reactions: { "🎉": 4, "👍": 2 } },
  { id: "cm2", channelId: "general", threadId: null, userId: "e10", name: "Charley Marquardt", text: "Two offers accepted this week — Xavier joins the design team on Sep 3!", time: "2026-08-29T09:02:00Z", reactions: { "🔥": 3 } },
  { id: "cm3", channelId: "engineering", threadId: null, userId: "e2", name: "Lila Lueilwitz", text: "OCR fix is on staging. Can someone run the regression pack before I merge?", time: "2026-08-29T09:31:00Z", reactions: { "👀": 1 } },
  { id: "cm4", channelId: "engineering", threadId: "cm3", userId: "e9", name: "Conrad Johnston", text: "On it — will report in an hour.", time: "2026-08-29T09:40:00Z", reactions: {} },
  { id: "cm5", channelId: "engineering", threadId: "cm3", userId: "e2", name: "Lila Lueilwitz", text: "Legend. If it's green, tag the release v6.1.1.", time: "2026-08-29T09:42:00Z", reactions: { "✅": 1 } },
  { id: "cm6", channelId: "engineering", threadId: null, userId: "e1", name: "Mohammed Ziemann", text: "Reminder: RBAC phase-2 scope locks today. Raise anything in the sprint review at 10.", time: "2026-08-29T09:55:00Z", reactions: {} },
  { id: "cm7", channelId: "design", threadId: null, userId: "e6", name: "Naomi Rempel", text: "New auth flow mocks are in the project files — auth-flows-v3.fig. Critique welcome 🙏", time: "2026-08-29T10:05:00Z", reactions: { "❤️": 2 } },
  { id: "cm8", channelId: "delivery", threadId: null, userId: "e7", name: "Charles Jast", text: "Heller Group signed off milestone 1. Invoice INV#016 went out — 9k already paid.", time: "2026-08-29T10:20:00Z", reactions: { "💰": 2 } },
  { id: "cm9", channelId: "delivery", threadId: null, userId: "e3", name: "Alden Glover", text: "RTA client demo moved to Monday 3pm. I'll spin up a meeting room and share the link here.", time: "2026-08-29T10:26:00Z", reactions: {} },
  { id: "cm10", channelId: "sales", threadId: null, userId: "e7", name: "Charles Jast", text: "ERP integration deal ($48k) moved to negotiation. Need engineering effort estimate by Wednesday.", time: "2026-08-29T10:40:00Z", reactions: { "👍": 1 } },
  { id: "cm11", channelId: "announcements", threadId: null, userId: "e1", name: "Mohammed Ziemann", text: "Office closed on Founders Day (Aug 25 was moved to Sep 1). Payroll runs as usual.", time: "2026-08-28T16:00:00Z", reactions: { "👍": 5 } },
];

/* ---------------- virtual office ---------------- */
export type Floor = { id: string; name: string };
export const floors: Floor[] = [
  { id: "f1", name: "Floor 1 · Product" },
  { id: "f2", name: "Floor 2 · Business" },
];

export type OfficeRoom = {
  id: string;
  floorId: string;
  name: string;
  type: "work" | "meeting" | "social" | "quiet";
  icon: string;
  capacity: number;
};

export const officeRooms: OfficeRoom[] = [
  { id: "lobby", floorId: "f1", name: "Lobby", type: "social", icon: "🛋️", capacity: 20 },
  { id: "desks-a", floorId: "f1", name: "Open Desks A", type: "work", icon: "💻", capacity: 12 },
  { id: "focus-pods", floorId: "f1", name: "Focus Pods", type: "quiet", icon: "🎧", capacity: 6 },
  { id: "room-alpha", floorId: "f1", name: "Meeting Room Alpha", type: "meeting", icon: "📽️", capacity: 8 },
  { id: "room-beta", floorId: "f1", name: "Meeting Room Beta", type: "meeting", icon: "🖥️", capacity: 6 },
  { id: "lounge", floorId: "f1", name: "Lounge", type: "social", icon: "☕", capacity: 10 },
  { id: "war-room", floorId: "f2", name: "War Room", type: "meeting", icon: "🧭", capacity: 10 },
  { id: "studio", floorId: "f2", name: "Design Studio", type: "work", icon: "🎨", capacity: 8 },
  { id: "sales-pit", floorId: "f2", name: "Sales Pit", type: "work", icon: "📈", capacity: 8 },
  { id: "library", floorId: "f2", name: "Library", type: "quiet", icon: "📚", capacity: 6 },
];

/* ---------------- meet (Teams-style) ---------------- */
export type TeamMeeting = {
  id: string;
  title: string;
  roomId: string;
  date: string;
  time: string;
  duration: string;
  organizer: string;
  attendees: string[];
  projectId?: string;
};

export const teamMeetings: TeamMeeting[] = [
  { id: "tm1", title: "Sprint Review — User Management", roomId: "meet-sprint-um", date: "2026-08-31", time: "10:00 am", duration: "45 min", organizer: "e1", attendees: ["e1", "e2", "e4", "e6"], projectId: "p1" },
  { id: "tm2", title: "RTA Client Demo", roomId: "meet-rta-demo", date: "2026-08-31", time: "03:00 pm", duration: "60 min", organizer: "e3", attendees: ["e3", "e2", "e9"], projectId: "p2" },
  { id: "tm3", title: "Design Critique — Auth Flows", roomId: "meet-design-crit", date: "2026-09-01", time: "11:30 am", duration: "30 min", organizer: "e6", attendees: ["e6", "e8", "e3"], projectId: "p1" },
  { id: "tm4", title: "Hiring Sync", roomId: "meet-hiring", date: "2026-09-02", time: "09:30 am", duration: "30 min", organizer: "e10", attendees: ["e10", "e1"] },
];

export type Recording = {
  id: string;
  title: string;
  roomId: string;
  by: string;
  size: number;
  date: string;
  url: string;
};

export const recordings: Recording[] = [];
