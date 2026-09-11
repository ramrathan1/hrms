import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

export function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  trend,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  sub?: string;
  trend?: { value: string; up?: boolean };
}) {
  return (
    <div className="card flex items-start gap-3.5 px-5 py-4">
      {Icon && (
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon size={19} />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-muted">{label}</p>
        <p className="mt-1 flex items-baseline gap-2 font-display text-[22px] font-bold text-ink tabular-nums">
          {value}
          {trend && (
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${trend.up === false ? "bg-bad-soft text-bad" : "bg-good-soft text-good"}`}>
              {trend.value}
            </span>
          )}
        </p>
        {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
      </div>
    </div>
  );
}

export function ChartCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
