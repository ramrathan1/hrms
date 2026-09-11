import {
  Award, BarChart3, Briefcase, Building2, CalendarDays, ClipboardList, DollarSign,
  DoorOpen, Fingerprint, Headphones, History, Inbox, LayoutDashboard, Link2, Mail, MessageSquare,
  Package, QrCode, Server, Settings, SquareUser, Target, Users,
  Video, Wallet, Webhook, BookOpen, Megaphone, MonitorSmartphone, type LucideIcon,
} from "lucide-react";

export type NavItem = {
  section?: string;
  label: string;
  icon: LucideIcon;
  to?: string;
  badge?: number;
  children?: { label: string; to: string }[];
};

export const NAV: NavItem[] = [
  {
    section: "Workspace",
    label: "Dashboard", icon: LayoutDashboard,
    children: [
      { label: "Private Dashboard", to: "/dashboard" },
      { label: "Advanced Dashboard", to: "/dashboard/advanced" },
    ],
  },
  { label: "My Calendar", icon: CalendarDays, to: "/calendar" },
  { label: "Approvals", icon: Inbox, to: "/approvals" },
  { section: "Collaboration", label: "Mail", icon: Mail, to: "/mail" },
  { label: "Virtual Office", icon: DoorOpen, to: "/office" },
  { label: "Meet", icon: Video, to: "/meet" },
  { label: "Communication", icon: MessageSquare, to: "/chat", badge: 1 },
  {
    section: "CRM & Sales", label: "Leads", icon: SquareUser,
    children: [
      { label: "Lead Contacts", to: "/leads" },
      { label: "Deals", to: "/deals" },
      { label: "Lead Forms", to: "/lead-forms" },
    ],
  },
  { label: "Clients", icon: Briefcase, to: "/clients" },
  {
    section: "Operations", label: "HR", icon: Users,
    children: [
      { label: "Employees", to: "/hr/employees" },
      { label: "Onboarding", to: "/hr/onboarding" },
      { label: "Leaves", to: "/hr/leaves" },
      { label: "Shift Roster", to: "/hr/shifts" },
      { label: "Attendance", to: "/hr/attendance" },
      { label: "Holiday", to: "/hr/holidays" },
      { label: "Designation", to: "/hr/designations" },
      { label: "Department", to: "/hr/departments" },
      { label: "Appreciation", to: "/hr/appreciations" },
    ],
  },
  {
    label: "Work", icon: ClipboardList,
    children: [
      { label: "Contracts", to: "/work/contracts" },
      { label: "Projects", to: "/work/projects" },
      { label: "Tasks", to: "/work/tasks" },
      { label: "Team Workload", to: "/work/workload" },
      { label: "Timesheet", to: "/work/timesheets" },
      { label: "Project Roadmap", to: "/roadmap" },
    ],
  },
  {
    label: "Finance", icon: DollarSign,
    children: [
      { label: "Proposals", to: "/finance/proposals" },
      { label: "Estimates", to: "/finance/estimates" },
      { label: "Invoices", to: "/finance/invoices" },
      { label: "Recurring", to: "/finance/recurring" },
      { label: "Payments", to: "/finance/payments" },
      { label: "Credit Notes", to: "/finance/credit-notes" },
      { label: "Expenses", to: "/finance/expenses" },
      { label: "Bank Account", to: "/finance/bank-accounts" },
    ],
  },
  { label: "Tickets", icon: Headphones, to: "/tickets" },
  { label: "Events", icon: CalendarDays, to: "/events" },
  { label: "Notice Board", icon: Megaphone, to: "/notices" },
  { label: "Knowledge Base", icon: BookOpen, to: "/knowledge" },
  { label: "Assets", icon: MonitorSmartphone, to: "/assets" },
  { label: "Biolinks", icon: Link2, to: "/biolinks" },
  {
    label: "Biometric", icon: Fingerprint,
    children: [
      { label: "Devices", to: "/biometric" },
      { label: "Attendance Logs", to: "/biometric/logs" },
    ],
  },
  { label: "Letter", icon: Mail, to: "/letters" },
  { section: "People", label: "Payroll", icon: Wallet, to: "/payroll" },
  {
    label: "Performance", icon: Target,
    children: [
      { label: "Dashboard", to: "/performance" },
      { label: "Objectives", to: "/performance/objectives" },
      { label: "1-on-1 Meetings", to: "/performance/meetings" },
    ],
  },
    { label: "QR Code", icon: QrCode, to: "/qr-codes" },
  {
    label: "Recruit", icon: Building2,
    children: [
      { label: "Dashboard", to: "/recruit" },
      { label: "Jobs", to: "/recruit/jobs" },
      { label: "Job Applications", to: "/recruit/applications" },
      { label: "Interview Schedule", to: "/recruit/interviews" },
      { label: "Offer Letters", to: "/recruit/offers" },
      { label: "Candidate Database", to: "/recruit/candidates" },
    ],
  },
  {
    label: "Server Manager", icon: Server,
    children: [
      { label: "Overview", to: "/servers" },
      { label: "Hosting Management", to: "/servers/hosting" },
      { label: "Domain Management", to: "/servers/domains" },
    ],
  },
  { label: "Webhooks", icon: Webhook, to: "/webhooks" },
  { label: "Reports", icon: BarChart3, to: "/reports" },
  { label: "Audit Log", icon: History, to: "/audit" },
  { label: "Settings", icon: Settings, to: "/settings/company" },
];
