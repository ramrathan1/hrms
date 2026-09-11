import clsx from "clsx";
import {
  Bell, Check, ChevronDown, ChevronRight, Menu, Pause, Play, Plus, Power, Search, Square, Video, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CURRENT_USER, logout, setRole, useRole, useToast } from "@/lib/store";
import { ROLES, canAccess, roleById } from "@/lib/roles";
import { useTimer } from "@/lib/timer";
import { notify, useNotifications } from "@/lib/notify";
import { wsc } from "@/lib/ws";
import { NAV, type NavItem } from "@/nav";
import { Avatar, Dropdown } from "./ui";
import { apiErrors, searchAll } from "@/lib/api";
import { useRouteData } from "@/lib/useRouteData";
import { ErrorBoundary } from "./ErrorBoundary";
import { StickyNotes } from "./StickyNotes";

function SideItem({ item }: { item: NavItem }) {
  const loc = useLocation();
  const activeChild = item.children?.some((c) => loc.pathname === c.to || loc.pathname.startsWith(c.to + "/"));
  const [open, setOpen] = useState(!!activeChild);
  useEffect(() => {
    if (activeChild) setOpen(true);
  }, [activeChild]);

  if (!item.children) {
    return (
      <NavLink
        to={item.to!}
        className={({ isActive }) =>
          clsx(
            "mx-2.5 flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] transition-colors",
            isActive
              ? "bg-primary-soft font-semibold text-primary"
              : "text-muted hover:bg-page hover:text-ink"
          )
        }
      >
        <item.icon size={16} className="shrink-0" />
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge && (
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>
        )}
      </NavLink>
    );
  }
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "mx-2.5 flex w-[calc(100%-20px)] cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] transition-colors",
          activeChild ? "font-semibold text-ink" : "text-muted hover:bg-page hover:text-ink"
        )}
      >
        <item.icon size={16} className="shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronRight size={13} className={clsx("text-faint transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="mb-1 space-y-0.5">
          {item.children.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              end={c.to === "/dashboard" || c.to === "/performance" || c.to === "/recruit" || c.to === "/servers" || c.to === "/biometric"}
              className={({ isActive }) =>
                clsx(
                  "mx-2.5 block rounded-[10px] py-1.5 pr-3 pl-10 text-[13px] transition-colors",
                  isActive
                    ? "bg-primary-soft font-semibold text-primary"
                    : "text-faint hover:bg-page hover:text-ink"
                )
              }
            >
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickAdd() {
  const nav = useNavigate();
  return (
    <Dropdown
      align="right"
      button={
        <button className="btn-ghost px-2" aria-label="Quick add">
          <Plus size={18} />
        </button>
      }
      items={[
        { label: "Add Task", onClick: () => nav("/work/tasks?new=1") },
        { label: "Add Project", onClick: () => nav("/work/projects/new") },
        { label: "Add Client", onClick: () => nav("/clients/new") },
        { label: "Add Invoice", onClick: () => nav("/finance/invoices/new") },
        { label: "Add Employee", onClick: () => nav("/hr/employees/new") },
        { label: "Log Time", onClick: () => nav("/work/timesheets?new=1") },
      ]}
    />
  );
}

const KIND_TINT: Record<string, string> = {
  task: "bg-primary-soft text-primary",
  invoice: "bg-good-soft text-good",
  leave: "bg-warn-soft text-[#a9720e]",
  chat: "bg-info-soft text-info",
  deal: "bg-primary-soft text-primary",
  ticket: "bg-bad-soft text-bad",
  system: "bg-page text-muted",
};

function Notifications() {
  const [open, setOpen] = useState(false);
  const { list, unread } = useNotifications();
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative px-2" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute top-0 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9.5px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-88 rounded-xl border border-line bg-white shadow-xl" style={{ width: 340 }}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold">Notifications {unread > 0 && <span className="text-faint">· {unread} new</span>}</span>
            <button className="cursor-pointer text-xs font-semibold text-primary hover:underline" onClick={() => notify.markAllRead()}>
              Mark all read
            </button>
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {list.map((n) => (
              <li key={n.id}>
                <button
                  className={clsx("flex w-full cursor-pointer gap-3 px-4 py-3 text-left text-sm hover:bg-page", !n.read && "bg-primary-soft/40")}
                  onClick={() => {
                    notify.markRead(n.id);
                    if (n.to) nav(n.to);
                    setOpen(false);
                  }}
                >
                  <span className={clsx("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase", KIND_TINT[n.kind])}>
                    {n.kind.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={clsx("block", !n.read && "font-semibold")}>{n.text}</span>
                    {n.detail && <span className="mt-0.5 block truncate text-xs text-muted">{n.detail}</span>}
                    <span className="mt-0.5 block text-xs text-faint">{n.time}</span>
                  </span>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-4 py-10 text-center text-sm text-faint">You're all caught up 🎉</li>}
          </ul>
          <div className="border-t border-line px-4 py-2.5 text-center">
            <button className="cursor-pointer text-xs font-semibold text-muted hover:text-ink" onClick={() => notify.clear()}>
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type Hit = { type: string; id: string; label: string; sub?: string; to: string };

function GlobalSearch({ asInput }: { asInput?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const targets = [
    ["Dashboard", "/dashboard"], ["Clients", "/clients"], ["Projects", "/work/projects"],
    ["Tasks", "/work/tasks"], ["Invoices", "/finance/invoices"], ["Employees", "/hr/employees"],
    ["Attendance", "/hr/attendance"], ["Deals", "/deals"], ["Tickets", "/tickets"],
    ["Payroll", "/payroll"], ["Reports", "/reports"], ["Settings", "/settings/company"],
  ] as const;
  const pages = targets.filter(([t]) => t.toLowerCase().includes(q.toLowerCase()));

  // ⌘K / Ctrl-K opens search anywhere
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // live record search across the local store
  useEffect(() => {
    if (!q.trim()) {
      setHits([]);
      return;
    }
    setLoading(true);
    let live = true;
    const t = setTimeout(() => {
      void searchAll(q).then((results) => {
        // A slower earlier query must not overwrite a newer one's results.
        if (!live) return;
        setHits(results as Hit[]);
        setLoading(false);
      });
    }, 140);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const grouped = hits.reduce<Record<string, Hit[]>>((acc, h) => {
    (acc[h.type] ??= []).push(h);
    return acc;
  }, {});
  return (
    <>
      {asInput ? (
        <button
          className="mr-2 flex w-9 cursor-text items-center gap-2 rounded-[10px] border border-line bg-white/80 px-2 py-2 text-sm text-faint hover:border-primary/40 sm:w-56 sm:px-3 xl:w-64"
          onClick={() => setOpen(true)}
          aria-label="Search"
        >
          <Search size={14} className="shrink-0" />
          <span className="hidden truncate sm:inline">Search anything…</span>
          <span className="ml-auto hidden rounded-md border border-line bg-page px-1.5 py-0.5 text-[10px] font-semibold text-muted xl:inline">⌘K</span>
        </button>
      ) : (
        <button className="btn-ghost px-2" onClick={() => setOpen(true)} aria-label="Search">
          <Search size={17} />
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-6 pt-24" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search size={16} className="text-faint" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search clients, projects, tasks, invoices, people…"
                className="w-full py-3.5 text-sm outline-none"
              />
              {loading && <span className="text-xs text-faint">…</span>}
              <button onClick={() => setOpen(false)} aria-label="Close search">
                <X size={16} className="text-faint" />
              </button>
            </div>
            <ul className="max-h-96 overflow-y-auto py-1">
              {Object.entries(grouped).map(([type, list]) => (
                <li key={type}>
                  <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold tracking-wider text-faint uppercase">{type}</p>
                  {list.map((h) => (
                    <button
                      key={h.type + h.id}
                      className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm hover:bg-page"
                      onClick={() => {
                        setOpen(false);
                        setQ("");
                        nav(h.to);
                      }}
                    >
                      <Avatar name={h.label} size={26} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{h.label}</span>
                        {h.sub && <span className="block truncate text-xs text-muted">{h.sub}</span>}
                      </span>
                    </button>
                  ))}
                </li>
              ))}
              {pages.length > 0 && (
                <li>
                  <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold tracking-wider text-faint uppercase">Go to</p>
                  {pages.map(([t, to]) => (
                    <button
                      key={to}
                      className="w-full cursor-pointer px-4 py-2 text-left text-sm hover:bg-page"
                      onClick={() => {
                        setOpen(false);
                        setQ("");
                        nav(to);
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </li>
              )}
              {q && hits.length === 0 && pages.length === 0 && !loading && (
                <li className="px-4 py-8 text-center text-sm text-faint">No results for “{q}”</li>
              )}
              {!q && <li className="px-4 py-8 text-center text-sm text-faint">Type to search across every module</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

export function AppShell() {
  /* Fetches whatever the screen you just opened needs, once. Mounted here so
     the pages below stay unaware of loading entirely. */
  const routeData = useRouteData();
  const timer = useTimer();
  const nav = useNavigate();
  const loc = useLocation();
  const { push } = useToast();
  const [navOpen, setNavOpen] = useState(false);
  const user = useRole();
  const role = roleById(user.roleId);

  /* The sidebar shows only what this role can open. A parent survives if it or
     any of its children is allowed, and the children are filtered too. */
  const visibleNav = NAV.map((item) => {
    const children = item.children?.filter((c) => canAccess(role, c.to));
    const selfOk = item.to ? canAccess(role, item.to) : false;
    if (!selfOk && !(children && children.length)) return null;
    return children ? { ...item, children } : item;
  }).filter(Boolean) as NavItem[];

  /* Close the drawer on navigation, and on Escape. */
  useEffect(() => setNavOpen(false), [loc.pathname]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  // Store-level failures (storage full, unknown collection) would vanish silently.
  useEffect(
    () => apiErrors.subscribe(({ message, details }) => push(details?.length ? `${message}: ${details.join(", ")}` : message)),
    [push]
  );

  // real-time: identify to the hub, surface live notifications
  useEffect(() => {
    wsc.connect(CURRENT_USER.id, CURRENT_USER.name);
    return wsc.on("notify", ({ from, text }) => {
      push(`${from} ${text}`);
      notify.push({ kind: "system", text: `${from} ${text}` });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full">
      {/* Backdrop for the drawer; only reachable below lg. */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={clsx(
          "flex w-60 shrink-0 flex-col border-r border-line/80 bg-white/95 backdrop-blur-xl lg:bg-white/70",
          // Off-canvas by default, docked from lg up.
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0",
          navOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2.5 px-4.5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#4cc3ff] text-base font-black text-white shadow-md shadow-primary/30">W</span>
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate font-display text-[15px] font-bold text-ink">
              Worksuite <ChevronDown size={13} className="text-faint" />
            </p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-good" /> {CURRENT_USER.name}
            </p>
          </div>
          <button
            className="btn-ghost -mr-1 ml-auto cursor-pointer px-2 py-2 lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto pb-4 [scrollbar-width:thin]">
          {visibleNav.map((item) => (
            <div key={item.label}>
              {item.section && (
                <p className="mt-4 mb-1 px-5 text-[10px] font-bold tracking-[0.12em] text-faint uppercase first:mt-1">
                  {item.section}
                </p>
              )}
              <SideItem item={item} />
            </div>
          ))}
        </nav>
        <div className="mx-2.5 mb-3 flex items-center justify-between rounded-xl border border-line/80 bg-white/70 px-3 py-2 text-[11px] text-muted">
          <span className="font-semibold">📱 Mobile App</span>
          <span className="text-faint">v6.0.16</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* relative z-30: backdrop-blur makes the bar its own stacking context,
            which would otherwise paint its dropdowns underneath the page. */}
        <header className="relative z-30 flex h-14 shrink-0 items-center gap-1 border-b border-line/80 bg-white/60 px-3 backdrop-blur-xl sm:px-4">
          <button
            className="btn-ghost cursor-pointer px-2 py-2 lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            aria-expanded={navOpen}
          >
            <Menu size={18} />
          </button>
          <button className="btn-primary mr-3 hidden gap-2 px-3.5 py-2 text-xs sm:flex" onClick={() => nav("/meet?new=1")}>
            <Video size={14} /> Meet now
          </button>
          <div className="mr-auto min-w-0">
            <GlobalSearch asInput />
          </div>
          <div
            className={clsx(
              "mr-2 hidden items-center gap-2 rounded-[10px] border px-2.5 py-1.5 md:flex",
              timer.running ? "border-primary/40 bg-primary-soft" : "border-line bg-white/80"
            )}
            title={timer.taskLabel ?? "No task selected — start a timer from any task"}
          >
            {timer.taskLabel && (
              <span className="hidden max-w-32 truncate text-xs font-medium text-primary xl:block">{timer.taskLabel}</span>
            )}
            <span className="text-sm font-semibold tabular-nums">{timer.label}</span>
            <button
              onClick={timer.toggle}
              className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-info text-white"
              aria-label={timer.running ? "Pause timer" : "Start timer"}
            >
              {timer.running ? <Pause size={10} /> : <Play size={10} />}
            </button>
            <button
              onClick={() => {
                const res = timer.stop();
                push(res ? `${res.hours}h logged against ${timer.taskLabel}` : "Timer reset — start it from a task to log time");
              }}
              className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-bad text-white"
              aria-label="Stop timer"
            >
              <Square size={9} />
            </button>
          </div>
          <span className="hidden sm:contents">
            <StickyNotes />
            <QuickAdd />
          </span>
          <Notifications />
          <span className="mx-1.5 hidden h-6 w-px bg-line sm:block" />
          <Dropdown
            align="right"
            button={
              <button className="flex cursor-pointer items-center gap-2 rounded-[10px] px-1.5 py-1 hover:bg-page">
                <Avatar name={CURRENT_USER.name} size={30} />
                <span className="hidden text-left leading-tight lg:block">
                  <span className="block text-[13px] font-semibold">{CURRENT_USER.name.split(" ")[0]}</span>
                  <span className="block text-[10px] text-muted">{role.label}</span>
                </span>
                <ChevronDown size={13} className="text-faint" />
              </button>
            }
            items={[
              { label: <span className="text-[11px] font-bold tracking-wider text-faint uppercase">Switch role</span> },
              ...ROLES.map((r) => ({
                label: (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.accent }} />
                    <span className={clsx("flex-1", r.id === role.id && "font-semibold text-primary")}>{r.label}</span>
                    {r.id === role.id && <Check size={13} className="text-primary" />}
                  </span>
                ),
                onClick: () => {
                  setRole(r.id, r.label);
                  push(`Now viewing as ${r.label}`);
                  nav(r.home);
                },
              })),
              { label: <span className="my-1 block h-px bg-line" /> },
              { label: "My Profile", onClick: () => nav(`/hr/employees/${CURRENT_USER.id}`) },
              { label: "Settings", onClick: () => nav("/settings/company") },
              { label: "Log out", danger: true, onClick: () => { logout(); nav("/login"); } },
            ]}
          />
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          {/* A thin bar rather than blanking the screen: the page underneath is
              still usable, and most routes have their data within a moment. */}
          {routeData.loading && (
            <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary-soft">
              <div className="h-full w-1/3 animate-[loading_1s_ease-in-out_infinite] bg-primary" />
            </div>
          )}
          {/* Keyed on the route's data, not just its path.
              Half the screens read their rows from plain arrays rather than
              React state, so nothing tells them when a lazily-loaded
              collection arrives. Remounting once, the moment it does, is what
              stops a page showing its fallback forever. Revisits find the data
              already loaded and do not remount. */}
          <ErrorBoundary resetKey={routeData.dataKey}>
            <Outlet key={routeData.dataKey} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
