/**
 * What each screen needs loading before it can show anything.
 *
 * Signing in used to fetch every collection in the app — seventy-odd requests,
 * most of them for data the landing page never displayed. Now the shell loads
 * the directory it needs everywhere and each route asks for its own, once,
 * the first time you open it.
 *
 * Derived from what the page components actually import from `@/data`, so this
 * stays honest: a screen that reads a collection is listed against it. Routes
 * that hold no server data at all are simply absent.
 *
 * Collections the shell already has (employees, departments, settings, the
 * mailbox) are deliberately not repeated here, and the few tables that page
 * against the server fetch themselves.
 */
export const ROUTE_DATA: Record<string, string[]> = {
  "/approvals": ["estimates", "expenses", "leaves", "overtimeRequests", "tasks", "timeLogs"],
  "/assets": ["assets"],
  "/biolinks": ["biolinks"],
  "/biometric": ["biometricDevices"],
  "/biometric/logs": ["biometricDevices"],
  "/calendar": ["events", "holidays", "tasks"],
  "/chat": ["channelMessages", "channels"],
  "/clients": ["clients"],
  "/clients/new": ["clients"],
  "/dashboard": ["events", "leaves", "projects", "tasks", "tickets", "todos"],
  "/dashboard/advanced": ["clients", "deals", "expenses", "invoices", "leads", "leaves", "projects", "tasks", "tickets"],
  "/deals": ["deals", "leads", "pipelineStages"],
  "/events": ["events"],
  "/finance/credit-notes": ["clients", "creditNotes", "invoices"],
  "/finance/expenses": ["expenses", "recurringExpenses"],
  "/finance/invoices": ["clients", "invoices"],
  "/finance/invoices/new": ["clients", "invoices", "projects"],
  "/finance/payments": ["invoices"],
  "/finance/proposals": ["clients", "estimates", "leads", "proposals"],
  "/finance/recurring": ["clients", "invoices", "recurringInvoices"],
  "/hr/appreciations": ["appreciations", "awards"],
  "/hr/holidays": ["holidays"],
  "/hr/leaves": ["leaves"],
  "/hr/shifts": ["shifts"],
  "/knowledge": ["kbArticles"],
  "/lead-forms": ["leadForms"],
  "/leads": ["leads"],
  "/letters": ["generatedLetters", "letterTemplates", "salaries"],
  "/meet": ["projects", "recordings", "teamMeetings"],
  "/meet/:roomId": ["officeRooms", "recordings", "teamMeetings"],
  "/notices": ["notices"],
  "/office": ["floors", "officeRooms"],
  "/payroll": ["overtimeRequests", "payslips", "salaries", "salaryHistory"],
  "/performance": ["objectives"],
  "/performance/meetings": ["meetings"],
  "/performance/objectives": ["keyResults", "objectives"],
  "/portal/:clientId": ["clients", "estimates", "invoices", "projects", "tickets"],
  "/portal/accountant": ["applications", "clients", "expenses", "interviews", "invoices", "jobs", "leaves", "milestones", "projects", "tasks", "tickets", "timeLogs"],
  "/portal/client": ["applications", "clients", "expenses", "interviews", "invoices", "jobs", "leaves", "milestones", "projects", "tasks", "tickets", "timeLogs"],
  "/portal/hr": ["applications", "clients", "expenses", "interviews", "invoices", "jobs", "leaves", "milestones", "projects", "tasks", "tickets", "timeLogs"],
  "/portal/manager": ["applications", "clients", "expenses", "interviews", "invoices", "jobs", "leaves", "milestones", "projects", "tasks", "tickets", "timeLogs"],
  "/portal/me": ["applications", "clients", "expenses", "interviews", "invoices", "jobs", "leaves", "milestones", "projects", "tasks", "tickets", "timeLogs"],
  "/portal/owner": ["applications", "clients", "expenses", "interviews", "invoices", "jobs", "leaves", "milestones", "projects", "tasks", "tickets", "timeLogs"],
  "/portal/team-leader": ["applications", "clients", "expenses", "interviews", "invoices", "jobs", "leaves", "milestones", "projects", "tasks", "tickets", "timeLogs"],
  "/qr-codes": ["qrCodes"],
  "/recruit": ["applications", "funnel", "interviews", "jobs"],
  "/recruit/applications": ["applications", "interviews", "jobs"],
  "/recruit/candidates": ["applications", "jobs"],
  "/recruit/interviews": ["applications", "interviews", "jobs"],
  "/recruit/jobs": ["jobs"],
  "/recruit/offers": ["applications", "offers"],
  "/roadmap": ["roadmapIdeas"],
  "/servers": ["domains", "hostings"],
  "/servers/domains": ["domains", "hostings"],
  "/servers/hosting": ["domains", "hostings"],
  "/tickets": ["clients", "tickets"],
  "/webhooks": ["webhooks"],
  "/work/contracts": ["clients", "contracts"],
  "/work/projects": ["clients", "projects"],
  "/work/projects/new": ["clients", "projects"],
  "/work/tasks": ["projects", "tasks"],
  "/work/timesheets": ["projects", "tasks", "timeLogs"],
  "/work/workload": ["leaves", "projects", "tasks"],
};

/**
 * The collections a path needs.
 *
 * Detail routes carry an id — `/clients/a1b2` — so the longest declared prefix
 * wins, which is how `/work/projects/:id/report` gets the same data as
 * `/work/projects` without every id being listed.
 */
export function collectionsFor(pathname: string): string[] {
  const exact = ROUTE_DATA[pathname];
  if (exact) return exact;

  let best: string[] = [];
  let bestLength = -1;
  for (const [route, needs] of Object.entries(ROUTE_DATA)) {
    if (route.length > bestLength && (pathname === route || pathname.startsWith(route + "/"))) {
      best = needs;
      bestLength = route.length;
    }
  }
  return best;
}
