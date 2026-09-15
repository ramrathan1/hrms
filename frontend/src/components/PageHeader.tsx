import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { roleById } from "@/lib/roles";
import { useRole } from "@/lib/store";

export function PageHeader({
  title,
  crumbs = [],
  actions,
}: {
  title: string;
  crumbs?: string[];
  actions?: ReactNode;
}) {
  /* "Home" used to point at /dashboard for everyone. Only some roles can open
     it, so for an employee the breadcrumb on every screen led to the "not part
     of this portal" wall. Send each role to its own landing page instead. */
  const home = roleById(useRole().roleId).home;

  return (
    <div className="sticky top-0 z-20 -mx-6 -mt-6 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line/80 bg-white/60 px-6 py-3.5 backdrop-blur-xl">
      <div className="flex items-baseline gap-3">
        <h1 className="text-lg font-bold">{title}</h1>
        <nav className="hidden items-center gap-1.5 text-xs text-faint sm:flex">
          <Link to={home} className="hover:text-primary">
            Home
          </Link>
          {[...crumbs, title].map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span>•</span>
              <span>{c}</span>
            </span>
          ))}
        </nav>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 -mt-1 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-line/80 bg-white/60 px-4 py-2.5 backdrop-blur-lg">
      {children}
    </div>
  );
}

/**
 * The period a page is showing.
 *
 * This is a label, not a control — nothing filters by it. It used to read
 * "01-08-2026 To 29-08-2026" on every page forever, which claimed a filter that
 * was never applied; it now says what it actually means. Give it a `value` when
 * a page really does scope its rows to a period.
 */
export function DurationFilter({ value }: { value?: string }) {
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-muted">Showing</span>
      <span className="font-medium">{value ?? "all time"}</span>
    </span>
  );
}
