import clsx from "clsx";
import { ChevronDown, FileQuestion, Flag, Search, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { initials, nameHue } from "@/lib/format";

/* ---------- avatar ---------- */
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const hue = nameHue(name);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hue} 55% 52%)`,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarName({
  name,
  sub,
  size = 34,
}: {
  name: string;
  sub?: string;
  size?: number;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <Avatar name={name} size={size} />
      <span className="leading-tight">
        <span className="block font-medium text-ink">{name}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
    </span>
  );
}

/* ---------- status pill ---------- */
const TONES: Record<string, string> = {
  // status → tone
  active: "good", completed: "good", complete: "good", paid: "good", approved: "good",
  hired: "good", open: "good", won: "good", accepted: "good", present: "good",
  finished: "good", enabled: "good", billed: "good", signed: "good", "in stock": "good",
  pending: "warn", "on hold": "warn", partial: "warn", draft: "warn", "phone screen": "warn",
  "partially paid": "warn", review: "warn", suspended: "warn", "awaiting approval": "warn",
  overdue: "bad", rejected: "bad", cancelled: "bad", canceled: "bad", incomplete: "bad",
  unpaid: "bad", lost: "bad", absent: "bad", expired: "bad", high: "bad", inactive: "bad",
  doing: "info", "in progress": "info", started: "info", interview: "info", sent: "info",
  "to do": "warn", medium: "warn", low: "good", "not started": "muted", applied: "muted",
  declined: "bad", transferring: "muted",
};
const TONE_CLASS: Record<string, [string, string]> = {
  good: ["bg-good-soft text-good", "bg-good"],
  warn: ["bg-warn-soft text-[#a9720e]", "bg-warn"],
  bad: ["bg-bad-soft text-bad", "bg-bad"],
  info: ["bg-info-soft text-info", "bg-info"],
  muted: ["bg-page text-muted", "bg-faint"],
};

const FLAG_COLOR: Record<string, string> = { high: "#e5554a", medium: "#e8983c", low: "#16a066" };

export function StatusPill({ status, tone }: { status: string; tone?: string }) {
  const key = status.toLowerCase();
  // priority values render as colored flags, like the reference designs
  if (!tone && FLAG_COLOR[key]) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap">
        <Flag size={13} fill={FLAG_COLOR[key]} color={FLAG_COLOR[key]} />
        {status}
      </span>
    );
  }
  const t = tone ?? TONES[key] ?? "muted";
  const [cls, dot] = TONE_CLASS[t] ?? TONE_CLASS.muted;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", cls)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", dot)} />
      {status}
    </span>
  );
}

/* ---------- progress ---------- */
export function Progress({ value, tone = "primary" }: { value: number; tone?: string }) {
  const color =
    tone === "good" || value >= 100 ? "bg-good" : value >= 60 ? "bg-primary" : value >= 30 ? "bg-warn" : "bg-bad";
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
        <span className={clsx("block h-full rounded-full", color)} style={{ width: `${Math.min(value, 100)}%` }} />
      </span>
      <span className="text-xs text-muted tabular-nums">{value}%</span>
    </span>
  );
}

/* ---------- tabs ---------- */
export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-wrap gap-1 overflow-x-auto border-b border-line", className)}>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={clsx(
            "-mb-px cursor-pointer border-b-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap",
            t === active
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-ink"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* ---------- modal ---------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  /* Portalled to the body: modals often open from inside a <form> (settings
     panes, detail pages), and a nested form submits natively and reloads. */
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-6" onClick={onClose}>
      <div
        className={clsx("card mt-10 w-full", wide ? "max-w-3xl" : "max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <button onClick={onClose} className="btn-ghost -mr-2 px-2 py-1.5" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

/* ---------- dropdown ---------- */
export function Dropdown({
  button,
  items,
  align = "right",
}: {
  button: ReactNode;
  items: { label: ReactNode; onClick?: () => void; danger?: boolean }[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative inline-block" ref={ref}>
      <span onClick={() => setOpen((o) => !o)}>{button}</span>
      {open && (
        <div
          className={clsx(
            "absolute z-30 mt-1 min-w-40 rounded-md border border-line bg-white py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => {
                setOpen(false);
                it.onClick?.();
              }}
              className={clsx(
                "block w-full cursor-pointer px-3.5 py-2 text-left text-sm hover:bg-page",
                it.danger ? "text-bad" : "text-ink"
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- select ---------- */
export function Select({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
}) {
  return (
    <label className={clsx("inline-flex items-center gap-2 text-sm", className)}>
      {label && <span className="text-muted">{label}</span>}
      <span className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input appearance-none py-1.5 pr-8 font-medium"
        >
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" />
      </span>
    </label>
  );
}

/* ---------- search ---------- */
export function SearchInput({
  value,
  onChange,
  placeholder = "Start typing to search",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <span className={clsx("relative inline-block", className)}>
      <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input w-64 py-1.5 pl-9"
      />
    </span>
  );
}

/* ---------- empty state ---------- */
export function EmptyState({ text = "- No record found. -" }: { text?: string }) {
  return <div className="flex flex-col items-center gap-2 py-14 text-sm text-faint">{text}</div>;
}

/**
 * Shown when a detail page is asked for a record that isn't there.
 *
 * Detail pages used to fall back to the first record in the collection, which
 * meant a stale link or a deleted row silently displayed *someone else's*
 * invoice — and crashed outright when the collection was empty. Saying so is
 * the only honest option.
 */
export function RecordNotFound({
  what,
  backTo,
  backLabel,
}: {
  /** The kind of thing, e.g. "invoice". */
  what: string;
  backTo: string;
  backLabel?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-page text-muted">
        <FileQuestion size={22} />
      </span>
      <p className="font-display text-lg font-bold">That {what} isn't here</p>
      <p className="max-w-sm text-sm text-muted">
        It may have been deleted, or you may not have access to it.
      </p>
      <Link to={backTo} className="btn-primary mt-1">
        {backLabel ?? `Back to ${what}s`}
      </Link>
    </div>
  );
}
