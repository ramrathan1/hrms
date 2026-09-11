import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { useRole } from "@/lib/store";
import { canAccess, roleById } from "@/lib/roles";
import { RequireRecord } from "@/components/RequireRecord";
import { AppShell } from "@/components/AppShell";
import { isLoggedIn } from "@/lib/store";

import Login from "@/pages/Login";
import ClientPortal from "@/pages/ClientPortal";
import PrivateDashboard from "@/pages/dashboard/Private";
import AdvancedDashboard from "@/pages/dashboard/Advanced";
import CalendarPage from "@/pages/CalendarPage";
import Approvals from "@/pages/Approvals";
import AuditLog from "@/pages/AuditLog";

import Leads from "@/pages/leads/Leads";
import LeadDetail from "@/pages/leads/LeadDetail";
import Deals from "@/pages/leads/Deals";
import LeadForms from "@/pages/leads/LeadForms";

import Clients from "@/pages/clients/Clients";
import ClientForm from "@/pages/clients/ClientForm";
import ClientDetail from "@/pages/clients/ClientDetail";

import Employees from "@/pages/hr/Employees";
import EmployeeForm from "@/pages/hr/EmployeeForm";
import EmployeeDetail from "@/pages/hr/EmployeeDetail";
import Leaves from "@/pages/hr/Leaves";
import Onboarding from "@/pages/hr/Onboarding";
import Attendance from "@/pages/hr/Attendance";
import Shifts from "@/pages/hr/Shifts";
import Holidays from "@/pages/hr/Holidays";
import Departments from "@/pages/hr/Departments";
import Designations from "@/pages/hr/Designations";
import Appreciations from "@/pages/hr/Appreciations";

import Contracts from "@/pages/work/Contracts";
import ContractDetail from "@/pages/work/ContractDetail";
import Projects from "@/pages/work/Projects";
import ProjectForm from "@/pages/work/ProjectForm";
import ProjectDetail from "@/pages/work/ProjectDetail";
import Tasks from "@/pages/work/Tasks";
import Timesheets from "@/pages/work/Timesheets";
import Roadmap from "@/pages/work/Roadmap";
import Workload from "@/pages/work/Workload";
import ProjectReport from "@/pages/work/ProjectReport";

import Proposals from "@/pages/finance/Proposals";
import ProposalForm, { ProposalDetail } from "@/pages/finance/ProposalForm";
import Estimates, { EstimateDetail } from "@/pages/finance/Estimates";
import Invoices from "@/pages/finance/Invoices";
import InvoiceForm from "@/pages/finance/InvoiceForm";
import InvoiceDetail from "@/pages/finance/InvoiceDetail";
import Payments from "@/pages/finance/Payments";
import RecurringInvoices from "@/pages/finance/RecurringInvoices";
import CreditNotes from "@/pages/finance/CreditNotes";
import Expenses from "@/pages/finance/Expenses";
import BankAccounts, { BankAccountDetail } from "@/pages/finance/BankAccounts";

import Tickets from "@/pages/ops/Tickets";
import TicketDetail from "@/pages/ops/TicketDetail";
import Events from "@/pages/ops/Events";
import Notices from "@/pages/ops/Notices";
import {
  AccountantPortal, ClientPortalHome, EmployeePortal, HrPortal, ManagerPortal,
  OwnerPortal, TeamLeaderPortal,
} from "@/pages/portals/Portals";
import Mail from "@/pages/mail/Mail";
import MailAccounts from "@/pages/mail/MailAccounts";
import Chat from "@/pages/chat/Chat";
import Office from "@/pages/office/Office";
import Meet from "@/pages/meet/Meet";
import MeetingRoom from "@/pages/meet/MeetingRoom";
import Knowledge from "@/pages/ops/Knowledge";
import Assets from "@/pages/ops/Assets";
import Biolinks from "@/pages/ops/Biolinks";
import Biometric from "@/pages/ops/Biometric";
import Letters from "@/pages/ops/Letters";
import QrCodes from "@/pages/ops/QrCodes";
import Webhooks from "@/pages/ops/Webhooks";
import Servers from "@/pages/ops/Servers";

import Payroll from "@/pages/payroll/Payroll";
import Performance from "@/pages/performance/Performance";
import Objectives from "@/pages/performance/Objectives";
import Meetings from "@/pages/performance/Meetings";

import RecruitDashboard from "@/pages/recruit/RecruitDashboard";
import Jobs from "@/pages/recruit/Jobs";
import Applications from "@/pages/recruit/Applications";
import Interviews from "@/pages/recruit/Interviews";
import Offers from "@/pages/recruit/Offers";
import Candidates from "@/pages/recruit/Candidates";

import ReportsIndex, { ReportPage } from "@/pages/reports/Reports";
import Settings from "@/pages/settings/Settings";

function Protected({ children }: { children: React.ReactElement }) {
  const loc = useLocation();
  if (!isLoggedIn()) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

/* Route-level role scoping. Not a security boundary — there is no server to
   enforce anything — but it keeps each role's app coherent, and says why when
   a link leads somewhere the current role doesn't cover. */
/** "/" resolves to whichever portal this role calls home. */
function RoleHome() {
  const user = useRole();
  return <Navigate to={roleById(user.roleId).home} replace />;
}

function RoleGate() {
  const loc = useLocation();
  const user = useRole();
  const role = roleById(user.roleId);
  if (canAccess(role, loc.pathname)) return <Outlet />;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warn-soft text-[#a9720e]">
        <Lock size={22} />
      </span>
      <p className="font-display text-lg font-bold">Not part of the {role.label} portal</p>
      <p className="max-w-md text-sm text-muted">
        <code className="rounded bg-page px-1.5 py-0.5 text-xs">{loc.pathname}</code> belongs to a
        different role. Switch role from the account menu, or head back to your own portal.
      </p>
      <Link to={role.home} className="btn-primary mt-1">Go to my portal</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/portal/:clientId" element={<ClientPortal />} />
      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route element={<RoleGate />}>
        <Route path="/" element={<RoleHome />} />
        {/* role portals — each role's landing screen */}
        <Route path="/portal/owner" element={<OwnerPortal />} />
        <Route path="/portal/manager" element={<ManagerPortal />} />
        <Route path="/portal/team-leader" element={<TeamLeaderPortal />} />
        <Route path="/portal/hr" element={<HrPortal />} />
        <Route path="/portal/accountant" element={<AccountantPortal />} />
        <Route path="/portal/me" element={<EmployeePortal />} />
        <Route path="/portal/client" element={<ClientPortalHome />} />
        <Route path="/dashboard" element={<PrivateDashboard />} />
        <Route path="/dashboard/advanced" element={<AdvancedDashboard />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/audit" element={<AuditLog />} />

        <Route path="/leads" element={<Leads />} />
        <Route
          path="/leads/:id"
          element={
            <RequireRecord collection="leads" what="lead" backTo="/leads">
              <LeadDetail />
            </RequireRecord>
          }
        />
        <Route path="/deals" element={<Deals />} />
        <Route path="/lead-forms" element={<LeadForms />} />

        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/new" element={<ClientForm />} />
        <Route
          path="/clients/:id"
          element={
            <RequireRecord collection="clients" what="client" backTo="/clients">
              <ClientDetail />
            </RequireRecord>
          }
        />

        <Route path="/hr/employees" element={<Employees />} />
        <Route path="/hr/employees/new" element={<EmployeeForm />} />
        <Route
          path="/hr/employees/:id"
          element={
            <RequireRecord collection="employees" what="employee" backTo="/hr/employees">
              <EmployeeDetail />
            </RequireRecord>
          }
        />
        <Route path="/hr/onboarding" element={<Onboarding />} />
        <Route path="/hr/leaves" element={<Leaves />} />
        <Route path="/hr/attendance" element={<Attendance />} />
        <Route path="/hr/shifts" element={<Shifts />} />
        <Route path="/hr/holidays" element={<Holidays />} />
        <Route path="/hr/departments" element={<Departments />} />
        <Route path="/hr/designations" element={<Designations />} />
        <Route path="/hr/appreciations" element={<Appreciations />} />

        <Route path="/work/contracts" element={<Contracts />} />
        <Route
          path="/work/contracts/:id"
          element={
            <RequireRecord collection="contracts" what="contract" backTo="/work/contracts">
              <ContractDetail />
            </RequireRecord>
          }
        />
        <Route path="/work/projects" element={<Projects />} />
        <Route path="/work/projects/new" element={<ProjectForm />} />
        <Route
          path="/work/projects/:id"
          element={
            <RequireRecord collection="projects" what="project" backTo="/work/projects">
              <ProjectDetail />
            </RequireRecord>
          }
        />
        <Route path="/work/workload" element={<Workload />} />
        <Route
          path="/work/projects/:id/report"
          element={
            <RequireRecord collection="projects" what="project" backTo="/work/projects">
              <ProjectReport />
            </RequireRecord>
          }
        />
        <Route path="/work/tasks" element={<Tasks />} />
        <Route path="/work/timesheets" element={<Timesheets />} />
        <Route path="/roadmap" element={<Roadmap />} />

        <Route path="/finance/proposals" element={<Proposals />} />
        <Route path="/finance/proposals/new" element={<ProposalForm />} />
        <Route
          path="/finance/proposals/:id"
          element={
            <RequireRecord collection="proposals" what="proposal" backTo="/finance/proposals">
              <ProposalDetail />
            </RequireRecord>
          }
        />
        <Route path="/finance/estimates" element={<Estimates />} />
        <Route
          path="/finance/estimates/:id"
          element={
            <RequireRecord collection="estimates" what="estimate" backTo="/finance/estimates">
              <EstimateDetail />
            </RequireRecord>
          }
        />
        <Route path="/finance/invoices" element={<Invoices />} />
        <Route path="/finance/invoices/new" element={<InvoiceForm />} />
        <Route
          path="/finance/invoices/:id"
          element={
            <RequireRecord collection="invoices" what="invoice" backTo="/finance/invoices">
              <InvoiceDetail />
            </RequireRecord>
          }
        />
        <Route path="/finance/recurring" element={<RecurringInvoices />} />
        <Route path="/finance/payments" element={<Payments />} />
        <Route path="/finance/credit-notes" element={<CreditNotes />} />
        <Route path="/finance/expenses" element={<Expenses />} />
        <Route path="/finance/bank-accounts" element={<BankAccounts />} />
        <Route
          path="/finance/bank-accounts/:id"
          element={
            <RequireRecord collection="bankAccounts" what="account" backTo="/finance/bank-accounts">
              <BankAccountDetail />
            </RequireRecord>
          }
        />

        <Route path="/tickets" element={<Tickets />} />
        <Route
          path="/tickets/:id"
          element={
            <RequireRecord collection="tickets" what="ticket" backTo="/tickets">
              <TicketDetail />
            </RequireRecord>
          }
        />
        <Route path="/events" element={<Events />} />
        <Route path="/mail" element={<Mail />} />
        <Route path="/mail/accounts" element={<MailAccounts />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/messages" element={<Navigate to="/chat" replace />} />
        <Route path="/office" element={<Office />} />
        <Route path="/meet" element={<Meet />} />
        <Route path="/meet/:roomId" element={<MeetingRoom />} />
        <Route path="/notices" element={<Notices />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/biolinks" element={<Biolinks />} />
        <Route path="/biometric" element={<Biometric />} />
        <Route path="/biometric/logs" element={<Biometric />} />
        <Route path="/letters" element={<Letters />} />
        <Route path="/qr-codes" element={<QrCodes />} />
        <Route path="/webhooks" element={<Webhooks />} />
        <Route path="/servers" element={<Servers />} />
        <Route path="/servers/hosting" element={<Servers />} />
        <Route path="/servers/domains" element={<Servers />} />

        <Route path="/payroll" element={<Payroll />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/performance/objectives" element={<Objectives />} />
        <Route path="/performance/meetings" element={<Meetings />} />

        <Route path="/recruit" element={<RecruitDashboard />} />
        <Route path="/recruit/jobs" element={<Jobs />} />
        <Route path="/recruit/applications" element={<Applications />} />
        <Route path="/recruit/interviews" element={<Interviews />} />
        <Route path="/recruit/offers" element={<Offers />} />
        <Route path="/recruit/candidates" element={<Candidates />} />

        <Route path="/reports" element={<ReportsIndex />} />
        <Route path="/reports/:report" element={<ReportPage />} />
        <Route path="/settings/:section" element={<Settings />} />

        </Route>
        <Route
          path="*"
          element={
            <div className="flex h-full flex-col items-center justify-center gap-2 py-24 text-muted">
              <p className="text-2xl font-bold">404 | Page not found.</p>
              <a href="/dashboard" className="text-primary">Back to home</a>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
