/* The signed-in person's own record.
 *
 * "My Profile" used to point at /hr/employees/<id>, which only HR and above may
 * open — so for an employee the menu item led straight to the "not part of this
 * portal" wall. Everyone can read their own details, so this page is allowed to
 * every role and always shows the account that is signed in. */
import { CalendarClock, Mail, Phone, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, StatusPill } from "@/components/ui";
import { byId } from "@/data/core";
import { currentProfile } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { allBalances, hasEntitlement } from "@/lib/leaveBalance";
import { roleById } from "@/lib/roles";
import { CURRENT_USER, useRole } from "@/lib/store";

type EmployeeRecord = {
  code?: string;
  designation?: string;
  department?: string;
  phone?: string;
  joined?: string;
  status?: string;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="w-40 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium break-words">{value || "—"}</dd>
    </div>
  );
}

export default function Profile() {
  const user = useRole();
  const role = roleById(user.roleId);
  const profile = currentProfile();
  // The HR record behind the login, when there is one. Several accounts — an
  // owner, a manager — legitimately have none.
  const employee = byId(CURRENT_USER.id) as EmployeeRecord | undefined;
  const entitled = hasEntitlement(CURRENT_USER.id);

  return (
    <>
      <PageHeader title="My Profile" />

      <div className="card mb-5 flex flex-wrap items-center gap-4 px-6 py-5">
        <Avatar name={CURRENT_USER.name} size={56} />
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold">{CURRENT_USER.name}</h2>
          <p className="text-sm text-muted">
            {employee?.designation || role.label}
            {employee?.department ? ` · ${employee.department}` : ""}
          </p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
          <ShieldCheck size={13} /> {role.label}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <header className="border-b border-line px-5 py-3.5">
            <h3 className="font-display text-[15px] font-bold">Account</h3>
          </header>
          <dl className="px-5 py-2">
            <Field label="Name" value={CURRENT_USER.name} />
            <Field label="Email" value={CURRENT_USER.email} />
            <Field label="Organisation" value={profile?.organizationName ?? ""} />
            <Field label="Role" value={role.label} />
            <Field
              label="Permissions"
              value={
                profile?.permissions?.includes("*")
                  ? "Everything"
                  : `${profile?.permissions?.length ?? 0} granted`
              }
            />
            <Field label="Home" value={role.home} />
          </dl>
        </section>

        <section className="card overflow-hidden">
          <header className="border-b border-line px-5 py-3.5">
            <h3 className="font-display text-[15px] font-bold">Employment</h3>
          </header>
          {employee ? (
            <dl className="px-5 py-2">
              <Field label="Employee ID" value={employee.code ?? ""} />
              <Field label="Designation" value={employee.designation ?? ""} />
              <Field label="Department" value={employee.department ?? ""} />
              <Field label="Phone" value={employee.phone ?? ""} />
              <Field label="Joined" value={employee.joined ? fmtDate(employee.joined) : ""} />
              <div className="flex gap-4 py-2.5">
                <dt className="w-40 shrink-0 text-sm text-muted">Status</dt>
                <dd><StatusPill status={employee.status ?? "Active"} /></dd>
              </div>
            </dl>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">
              This sign-in is not linked to an employee record. Attendance, leave
              and timesheets are kept against that record, so ask HR to connect
              them.
            </p>
          )}
        </section>

        <section className="card overflow-hidden xl:col-span-2">
          <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h3 className="font-display text-[15px] font-bold">Leave entitlement</h3>
            <span className="text-xs text-muted">
              <CalendarClock size={12} className="mr-1 inline" />
              {new Date().getFullYear()}
            </span>
          </header>
          {entitled ? (
            <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
              {allBalances(CURRENT_USER.id).map((b) => (
                <div key={b.type} className="bg-card px-5 py-4">
                  <p className="font-display text-2xl font-bold tabular-nums">
                    {b.remaining} <span className="text-base font-medium text-muted">/ {b.quota}</span>
                  </p>
                  <p className="text-sm font-medium">{b.type}</p>
                  <p className="text-xs text-muted">
                    {b.taken} taken{b.pending ? ` · ${b.pending} pending` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">
              No entitlement yet — it is set against an employee record.
            </p>
          )}
        </section>

        <section className="card overflow-hidden xl:col-span-2">
          <header className="border-b border-line px-5 py-3.5">
            <h3 className="font-display text-[15px] font-bold">Contact</h3>
          </header>
          <div className="flex flex-wrap gap-x-8 gap-y-2 px-5 py-4 text-sm">
            <a className="flex items-center gap-2 text-primary hover:underline" href={`mailto:${CURRENT_USER.email}`}>
              <Mail size={14} /> {CURRENT_USER.email}
            </a>
            {employee?.phone && (
              <span className="flex items-center gap-2 text-muted">
                <Phone size={14} /> {employee.phone}
              </span>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
