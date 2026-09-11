/* Role permission matrix — per-module view/create/edit/delete grants,
   persisted per role. Admin is locked to full access. */
import clsx from "clsx";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "./ui";
import { getRolePermissions, saveRolePermissions } from "@/lib/api";
import { useToast } from "@/lib/store";

const MODULES = [
  "Dashboard", "Leads", "Clients", "Projects", "Tasks", "Timesheets", "Invoices",
  "Estimates", "Payments", "Expenses", "Employees", "Attendance", "Leaves",
  "Payroll", "Tickets", "Recruit", "Reports", "Settings",
];
const ACTIONS = ["view", "create", "edit", "delete"] as const;
type Action = (typeof ACTIONS)[number];
type Grants = Record<string, Record<Action, boolean>>;

/** sensible starting point per role */
const preset = (role: string): Grants => {
  const g: Grants = {};
  MODULES.forEach((m) => {
    if (role === "App Administrator") g[m] = { view: true, create: true, edit: true, delete: true };
    else if (role === "Manager")
      g[m] = { view: true, create: m !== "Settings", edit: m !== "Settings", delete: ["Tasks", "Leads", "Expenses"].includes(m) };
    else if (role === "Client")
      g[m] = {
        view: ["Dashboard", "Projects", "Tasks", "Invoices", "Estimates", "Tickets"].includes(m),
        create: m === "Tickets",
        edit: false,
        delete: false,
      };
    else
      g[m] = {
        view: !["Payroll", "Settings"].includes(m),
        create: ["Tasks", "Timesheets", "Leaves", "Expenses", "Tickets"].includes(m),
        edit: ["Tasks", "Timesheets"].includes(m),
        delete: false,
      };
  });
  return g;
};

export function PermissionMatrix({
  role,
  locked,
  onClose,
}: {
  role: string | null;
  locked?: boolean;
  onClose: () => void;
}) {
  const { push } = useToast();
  const [grants, setGrants] = useState<Grants>({});

  useEffect(() => {
    if (!role) return;
    const saved = getRolePermissions(role);
    setGrants((saved as Grants) ?? preset(role));
  }, [role]);

  if (!role) return null;

  const toggle = (m: string, a: Action) => {
    if (locked) return;
    setGrants((g) => {
      const row = { ...g[m], [a]: !g[m]?.[a] };
      // granting any write implies view; removing view removes everything
      if (a !== "view" && row[a]) row.view = true;
      if (a === "view" && !row.view) ACTIONS.forEach((x) => (row[x] = false));
      return { ...g, [m]: row };
    });
  };

  const toggleAll = (a: Action, on: boolean) => {
    if (locked) return;
    setGrants((g) => {
      const next: Grants = {};
      MODULES.forEach((m) => {
        const row = { ...g[m], [a]: on };
        if (a !== "view" && on) row.view = true;
        if (a === "view" && !on) ACTIONS.forEach((x) => (row[x] = false));
        next[m] = row;
      });
      return next;
    });
  };

  const granted = MODULES.reduce((a, m) => a + ACTIONS.filter((x) => grants[m]?.[x]).length, 0);

  return (
    <Modal open onClose={onClose} title={`Permissions — ${role}`} wide>
      {locked ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-page px-3.5 py-2.5 text-sm text-muted">
          <Lock size={14} /> Administrator permissions are fixed and cannot be reduced.
        </p>
      ) : (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-primary-soft px-3.5 py-2.5 text-sm text-primary">
          <ShieldCheck size={14} /> {granted} of {MODULES.length * ACTIONS.length} permissions granted. Granting create/edit/delete automatically grants view.
        </p>
      )}

      <div className="max-h-[26rem] overflow-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="border-b border-line bg-[#f6f6fb] px-4 py-2.5 text-left text-[11px] font-bold tracking-wide text-faint uppercase">Module</th>
              {ACTIONS.map((a) => (
                <th key={a} className="border-b border-line bg-[#f6f6fb] px-3 py-2 text-center">
                  <span className="block text-[11px] font-bold tracking-wide text-faint uppercase">{a}</span>
                  {!locked && (
                    <span className="mt-0.5 flex justify-center gap-1">
                      <button className="cursor-pointer text-[10px] font-semibold text-primary hover:underline" onClick={() => toggleAll(a, true)}>all</button>
                      <span className="text-[10px] text-line">|</span>
                      <button className="cursor-pointer text-[10px] font-semibold text-muted hover:underline" onClick={() => toggleAll(a, false)}>none</button>
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m} className="hover:bg-page/60">
                <td className="border-b border-line/70 px-4 py-2 font-medium">{m}</td>
                {ACTIONS.map((a) => {
                  const on = locked || grants[m]?.[a];
                  return (
                    <td key={a} className="border-b border-line/70 px-3 py-2 text-center">
                      <button
                        disabled={locked}
                        onClick={() => toggle(m, a)}
                        aria-label={`${a} ${m}`}
                        className={clsx(
                          "inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                          on ? "border-primary bg-primary text-white" : "border-line bg-white hover:border-primary",
                          locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                        )}
                      >
                        {on && <Check size={12} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex items-center gap-3">
        {!locked && (
          <>
            <button
              className="btn-primary"
              onClick={() => {
                saveRolePermissions(role, grants);
                push(`Permissions saved for ${role}`);
                onClose();
              }}
            >
              Save permissions
            </button>
            <button className="btn-outline" onClick={() => setGrants(preset(role))}>Reset to default</button>
          </>
        )}
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
