/* Mail: accounts, folders, messages, contacts.
 *
 * Accounts carry the real shape of an IMAP/SMTP connection — host, port,
 * security, auth — because that is what you would fill in for a live provider.
 * Nothing here opens a socket: browsers can't speak IMAP or SMTP, so this build
 * simulates the connection and serves the mailbox below. Swapping in a real mail
 * bridge later means changing `lib/mail.ts`, not these shapes.
 */

export type MailSecurity = "SSL/TLS" | "STARTTLS" | "None";

export type MailAccount = {
  id: string;
  /** Display name on outgoing mail. */
  name: string;
  email: string;
  provider: string;
  color: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: MailSecurity;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: MailSecurity;
  username: string;
  /** Never a real secret in this build — accounts are local and simulated. */
  password: string;
  signature: string;
  status: "Connected" | "Not connected" | "Error";
  lastSync: string;
  default: boolean;
};

/** Known providers, so setup is one click instead of six fields. */
export const MAIL_PROVIDERS: {
  name: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: MailSecurity;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: MailSecurity;
  note?: string;
}[] = [
  {
    name: "Gmail",
    imapHost: "imap.gmail.com", imapPort: 993, imapSecurity: "SSL/TLS",
    smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecurity: "SSL/TLS",
    note: "Requires an app password when 2-step verification is on.",
  },
  {
    name: "Outlook / Microsoft 365",
    imapHost: "outlook.office365.com", imapPort: 993, imapSecurity: "SSL/TLS",
    smtpHost: "smtp.office365.com", smtpPort: 587, smtpSecurity: "STARTTLS",
  },
  {
    name: "Yahoo Mail",
    imapHost: "imap.mail.yahoo.com", imapPort: 993, imapSecurity: "SSL/TLS",
    smtpHost: "smtp.mail.yahoo.com", smtpPort: 465, smtpSecurity: "SSL/TLS",
    note: "Requires an app password.",
  },
  {
    name: "iCloud Mail",
    imapHost: "imap.mail.me.com", imapPort: 993, imapSecurity: "SSL/TLS",
    smtpHost: "smtp.mail.me.com", smtpPort: 587, smtpSecurity: "STARTTLS",
    note: "Requires an app-specific password.",
  },
  {
    name: "Zoho Mail",
    imapHost: "imap.zoho.com", imapPort: 993, imapSecurity: "SSL/TLS",
    smtpHost: "smtp.zoho.com", smtpPort: 465, smtpSecurity: "SSL/TLS",
  },
  {
    name: "Fastmail",
    imapHost: "imap.fastmail.com", imapPort: 993, imapSecurity: "SSL/TLS",
    smtpHost: "smtp.fastmail.com", smtpPort: 465, smtpSecurity: "SSL/TLS",
  },
  {
    name: "Custom (IMAP/SMTP)",
    imapHost: "", imapPort: 993, imapSecurity: "SSL/TLS",
    smtpHost: "", smtpPort: 587, smtpSecurity: "STARTTLS",
  },
];

export const mailAccounts: MailAccount[] = [
  {
    id: "ma1",
    name: "Mohammed Ziemann",
    email: "mohammed@worksuite.demo",
    provider: "Custom (IMAP/SMTP)",
    color: "#7C5CFF",
    imapHost: "imap.worksuite.demo", imapPort: 993, imapSecurity: "SSL/TLS",
    smtpHost: "smtp.worksuite.demo", smtpPort: 465, smtpSecurity: "SSL/TLS",
    username: "mohammed@worksuite.demo",
    password: "",
    signature: "Mohammed Ziemann\nTeam Lead · Worksuite\nmohammed@worksuite.demo",
    status: "Connected",
    lastSync: "2026-08-29T09:41:00Z",
    default: true,
  },
  {
    id: "ma2",
    name: "Worksuite Billing",
    email: "billing@worksuite.demo",
    provider: "Gmail",
    color: "#1fa971",
    imapHost: "imap.gmail.com", imapPort: 993, imapSecurity: "SSL/TLS",
    smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecurity: "SSL/TLS",
    username: "billing@worksuite.demo",
    password: "",
    signature: "Worksuite Billing\nbilling@worksuite.demo",
    status: "Connected",
    lastSync: "2026-08-29T08:05:00Z",
    default: false,
  },
];

export type MailFolder = {
  id: string;
  name: string;
  /** Drives the icon and the special-folder behaviour. */
  kind: "inbox" | "starred" | "sent" | "drafts" | "archive" | "spam" | "trash" | "custom";
  accountId: string | null;
  color?: string;
};

export const mailFolders: MailFolder[] = [
  { id: "inbox", name: "Inbox", kind: "inbox", accountId: null },
  { id: "starred", name: "Starred", kind: "starred", accountId: null },
  { id: "sent", name: "Sent", kind: "sent", accountId: null },
  { id: "drafts", name: "Drafts", kind: "drafts", accountId: null },
  { id: "archive", name: "Archive", kind: "archive", accountId: null },
  { id: "spam", name: "Spam", kind: "spam", accountId: null },
  { id: "trash", name: "Trash", kind: "trash", accountId: null },
  { id: "f-clients", name: "Clients", kind: "custom", accountId: null, color: "#7C5CFF" },
  { id: "f-invoices", name: "Invoices", kind: "custom", accountId: null, color: "#1fa971" },
  { id: "f-recruiting", name: "Recruiting", kind: "custom", accountId: null, color: "#e8983c" },
];

export type MailAddress = { name: string; email: string };

export type MailAttachment = { name: string; size: number; type: string };

export type MailMessage = {
  id: string;
  accountId: string;
  folderId: string;
  /** Messages sharing a threadId are one conversation. */
  threadId: string;
  subject: string;
  from: MailAddress;
  to: MailAddress[];
  cc?: MailAddress[];
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  labels: string[];
  attachments?: MailAttachment[];
  /** Set on drafts so the composer can reopen them. */
  draft?: boolean;
};

const me = { name: "Mohammed Ziemann", email: "mohammed@worksuite.demo" };
const billing = { name: "Worksuite Billing", email: "billing@worksuite.demo" };

export const mailMessages: MailMessage[] = [
  {
    id: "em1", accountId: "ma1", folderId: "inbox", threadId: "t1",
    subject: "Re: User Management — RBAC sign-off",
    from: { name: "Aleen Miller", email: "aleen@northwind.example" },
    to: [me],
    body: `Hi Mohammed,

We went through the permission matrix with the security team this morning. Two things before we can sign off:

1. Role inheritance — can a Manager grant permissions they don't hold themselves? We'd like that blocked.
2. The audit log needs to record who changed a role, not just that it changed.

Everything else looked good. Happy to jump on a call Thursday if that's easier.

Best,
Aleen`,
    date: "2026-08-29T08:42:00Z",
    read: false, starred: true, labels: ["f-clients"],
  },
  {
    id: "em2", accountId: "ma1", folderId: "inbox", threadId: "t1",
    subject: "Re: User Management — RBAC sign-off",
    from: me,
    to: [{ name: "Aleen Miller", email: "aleen@northwind.example" }],
    body: `Aleen,

Both are fair. Blocking privilege escalation is already in the matrix work — a Manager can only grant a subset of what they hold. I'll get the audit actor wired this sprint.

Thursday works. I'll send an invite.

Mohammed`,
    date: "2026-08-28T16:10:00Z",
    read: true, starred: false, labels: ["f-clients"],
  },
  {
    id: "em3", accountId: "ma1", folderId: "inbox", threadId: "t2",
    subject: "Invoice INV#1041 — payment scheduled",
    from: { name: "Accounts Payable", email: "ap@vertexlabs.example" },
    to: [billing], cc: [me],
    body: `Hello,

INV#1041 has been approved and is scheduled for payment on 2 September. Remittance advice will follow automatically.

One note — please quote PO 4471 on future invoices or they'll route to manual review.

Regards,
Vertex Labs Accounts Payable`,
    date: "2026-08-29T07:15:00Z",
    read: false, starred: false, labels: ["f-invoices"],
    attachments: [{ name: "remittance-advice.pdf", size: 84_210, type: "application/pdf" }],
  },
  {
    id: "em4", accountId: "ma1", folderId: "inbox", threadId: "t3",
    subject: "Senior Developer role — candidate availability",
    from: { name: "Charley Marquardt", email: "charley@worksuite.demo" },
    to: [me],
    body: `Morning,

Three of the five shortlisted candidates can do interviews next week. Two need the week after.

Shall I book the three in, or hold everyone until we can run them back to back? Holding means we lose about ten days.

Charley`,
    date: "2026-08-29T06:55:00Z",
    read: false, starred: false, labels: ["f-recruiting"],
  },
  {
    id: "em5", accountId: "ma1", folderId: "inbox", threadId: "t4",
    subject: "Railway tracking — data feed outage last night",
    from: { name: "Jalon Cronin", email: "jalon@rta.example" },
    to: [me],
    body: `Mohammed,

The arrival-time feed dropped between 23:40 and 01:20. Our dashboards showed stale predictions for about an hour before anyone noticed.

Can we add an alert when the feed goes quiet for more than five minutes? Happy to pay for the work.

Jalon`,
    date: "2026-08-28T22:30:00Z",
    read: true, starred: true, labels: ["f-clients"],
  },
  {
    id: "em6", accountId: "ma1", folderId: "inbox", threadId: "t5",
    subject: "Your September hosting renewal",
    from: { name: "Linode Billing", email: "billing@linode.example" },
    to: [me],
    body: `This is a reminder that your CDN Server plan renews on 6 September 2026.

No action is needed — the card ending 4471 will be charged automatically.`,
    date: "2026-08-28T11:00:00Z",
    read: true, starred: false, labels: [],
  },
  {
    id: "em7", accountId: "ma1", folderId: "inbox", threadId: "t6",
    subject: "Design review — Auth flows",
    from: { name: "Naomi Rempel", email: "naomi@worksuite.demo" },
    to: [me], cc: [{ name: "Alden Glover", email: "alden@worksuite.demo" }],
    body: `Hi both,

Put the revised auth screens in the shared folder. Main change is the two-factor step — it's now a single screen instead of three, and the recovery-code path is much shorter.

Would like eyes on it before Friday.

Naomi`,
    date: "2026-08-27T14:20:00Z",
    read: true, starred: false, labels: [],
    attachments: [
      { name: "auth-flows-v3.pdf", size: 2_410_880, type: "application/pdf" },
      { name: "recovery-codes.png", size: 318_040, type: "image/png" },
    ],
  },
  {
    id: "em8", accountId: "ma2", folderId: "inbox", threadId: "t7",
    subject: "Overdue: INV#1038",
    from: { name: "Bertrand Rodriguez", email: "bertrand@harbourco.example" },
    to: [billing],
    body: `Apologies for the delay on this one — it got stuck with our finance team while our approver was on leave.

It's been released this morning and should reach you within three working days.`,
    date: "2026-08-26T09:05:00Z",
    read: true, starred: false, labels: ["f-invoices"],
  },
  {
    id: "em9", accountId: "ma1", folderId: "sent", threadId: "t8",
    subject: "Sprint review — Thursday 15:00",
    from: me,
    to: [
      { name: "Lila Lueilwitz", email: "lila@worksuite.demo" },
      { name: "Alden Glover", email: "alden@worksuite.demo" },
      { name: "Kole Johnston", email: "kole@worksuite.demo" },
    ],
    body: `Team,

Sprint review moved to Thursday 15:00 so Aleen can join for the RBAC sign-off.

Come with your demo ready — we're keeping it to 40 minutes this time.

Mohammed`,
    date: "2026-08-28T10:00:00Z",
    read: true, starred: false, labels: [],
  },
  {
    id: "em10", accountId: "ma1", folderId: "sent", threadId: "t9",
    subject: "Statement of work — Document Management System",
    from: me,
    to: [{ name: "Vernice Rohan", email: "vernice@meridian.example" }],
    body: `Vernice,

Attached is the SOW covering phase one. Timeline is eight weeks from signature, with the milestone breakdown on page three.

Let me know if the payment schedule works for your finance team.

Mohammed`,
    date: "2026-08-25T13:45:00Z",
    read: true, starred: false, labels: ["f-clients"],
    attachments: [{ name: "sow-dms-phase-1.pdf", size: 512_400, type: "application/pdf" }],
  },
  {
    id: "em11", accountId: "ma1", folderId: "drafts", threadId: "t10",
    subject: "Q4 capacity planning",
    from: me,
    to: [{ name: "Alden Glover", email: "alden@worksuite.demo" }],
    body: `Alden,

Rough numbers for Q4 — we're short about 1.5 people on delivery if the Meridian work lands in October.

Options as I see them:`,
    date: "2026-08-29T09:20:00Z",
    read: true, starred: false, labels: [], draft: true,
  },
  {
    id: "em12", accountId: "ma1", folderId: "archive", threadId: "t11",
    subject: "Welcome to Worksuite",
    from: { name: "Worksuite", email: "hello@worksuite.demo" },
    to: [me],
    body: `Thanks for setting up your workspace.

Connect a mail account under Mail → Accounts to bring your inbox in alongside your projects, clients and invoices.`,
    date: "2026-08-01T09:00:00Z",
    read: true, starred: false, labels: [],
  },
  {
    id: "em13", accountId: "ma1", folderId: "spam", threadId: "t12",
    subject: "YOUR ACCOUNT HAS BEEN LIMITED — ACT NOW",
    from: { name: "Security Team", email: "no-reply@account-verify.example" },
    to: [me],
    body: `Dear Customer, your account has been limited. Click here within 24 hours to restore access.`,
    date: "2026-08-27T03:12:00Z",
    read: true, starred: false, labels: [],
  },
  {
    id: "em14", accountId: "ma1", folderId: "trash", threadId: "t13",
    subject: "Lunch?",
    from: { name: "Zane Stroman", email: "zane@worksuite.demo" },
    to: [me],
    body: `Anyone up for the Thai place at 12:30?`,
    date: "2026-08-26T11:02:00Z",
    read: true, starred: false, labels: [],
  },
];

export type MailContact = { id: string; name: string; email: string; company?: string };

export const mailContacts: MailContact[] = [
  { id: "mc1", name: "Aleen Miller", email: "aleen@northwind.example", company: "Northwind" },
  { id: "mc2", name: "Jalon Cronin", email: "jalon@rta.example", company: "RTA" },
  { id: "mc3", name: "Vernice Rohan", email: "vernice@meridian.example", company: "Meridian" },
  { id: "mc4", name: "Bertrand Rodriguez", email: "bertrand@harbourco.example", company: "Harbour Co" },
  { id: "mc5", name: "Lila Lueilwitz", email: "lila@worksuite.demo", company: "Worksuite" },
  { id: "mc6", name: "Alden Glover", email: "alden@worksuite.demo", company: "Worksuite" },
  { id: "mc7", name: "Kole Johnston", email: "kole@worksuite.demo", company: "Worksuite" },
  { id: "mc8", name: "Naomi Rempel", email: "naomi@worksuite.demo", company: "Worksuite" },
  { id: "mc9", name: "Charley Marquardt", email: "charley@worksuite.demo", company: "Worksuite" },
];
