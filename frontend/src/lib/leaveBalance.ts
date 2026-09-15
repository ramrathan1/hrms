/* Leave entitlement: per-type quotas, days taken, pending, and remaining.
   Used to show balances and to block requests that exceed entitlement.

   The quotas come from the server's /leave/balances, which knows the
   organisation's leave types and each employee's entitlement. This file used to
   hardcode { Casual: 10, Sick: 10, Earned: 10 }, which meant every employee was
   shown a full allowance whether or not any leave type had been configured —
   a number they could plan around, invented by the client. */
import { holidays, leaves, leaveQuota } from "@/data/hr";

export type Balance = {
  type: string;
  leaveTypeId?: string;
  quota: number;
  taken: number;
  pending: number;
  remaining: number;
};

type QuotaRow = {
  employee?: string;
  leaveTypeId?: string;
  type?: string;
  total?: number;
  taken?: number;
  pending?: number;
  remaining?: number;
};

const rows = (): QuotaRow[] => leaveQuota as unknown as QuotaRow[];

const dayValue = (duration: string) => (duration === "Full Day" ? 1 : 0.5);

/**
 * The leave types this organisation actually has, in the order the server
 * returned them. Empty until leave types are configured — the pickers and
 * balance tiles then render nothing rather than three invented allowances.
 */
export function leaveTypes(): Array<{ id?: string; name: string; quota: number }> {
  const seen = new Map<string, { id?: string; quota: number }>();
  for (const r of rows()) {
    if (r.type && !seen.has(r.type)) {
      seen.set(r.type, { id: r.leaveTypeId, quota: r.total ?? 0 });
    }
  }
  return [...seen].map(([name, v]) => ({ id: v.id, name, quota: v.quota }));
}

/**
 * Whether this person has leave entitlement at all.
 *
 * False when the signed-in account has no employee record behind it: the server
 * returns no balances, and every tile would otherwise read a flat 0 / 0, which
 * looks like an allowance of nothing rather than an account that HR has not
 * finished setting up.
 */
export function hasEntitlement(employeeId: string): boolean {
  return rows().some((r) => r.employee === employeeId);
}

/** The id the API wants for a leave type the user picked by name. */
export function leaveTypeIdFor(name: string): string | undefined {
  return rows().find((r) => r.type === name)?.leaveTypeId;
}

export function balanceFor(employeeId: string, type: string): Balance {
  const row = rows().find((r) => r.employee === employeeId && r.type === type);

  // The server already nets off approved leave; pending requests that have not
  // been decided yet are still only in the local list on this screen.
  const mine = leaves.filter((l) => l.employee === employeeId && l.type === type);
  const localPending = mine
    .filter((l) => l.status === "Pending")
    .reduce((a, l) => a + dayValue(l.duration), 0);

  const quota = row?.total ?? 0;
  const taken = row?.taken ?? 0;
  const pending = row?.pending ?? localPending;

  return {
    type,
    leaveTypeId: row?.leaveTypeId,
    quota,
    taken,
    pending,
    remaining: row?.remaining ?? Math.max(0, quota - taken - pending),
  };
}

export function allBalances(employeeId: string): Balance[] {
  return leaveTypes().map((t) => balanceFor(employeeId, t.name));
}

/** returns an error string when the request cannot be granted */
export function validateLeave(
  employeeId: string,
  type: string,
  duration: string,
  date: string
): string | null {
  if (!type) return "Choose a leave type.";
  if (!leaveTypeIdFor(type)) {
    return `"${type}" is not a leave type in this organisation. Ask HR to set it up.`;
  }

  /* Sunday is the weekly off and a public holiday belongs to everyone, so
     neither costs a day of entitlement. The server refuses these too — saying
     so here saves a round trip and explains why. */
  if (date && new Date(`${date}T00:00:00Z`).getUTCDay() === 0) {
    return "That date is a Sunday — already a day off, so no leave is needed.";
  }
  const holiday = holidays.find((h) => (h as { date?: string }).date === date);
  if (holiday) {
    return `That date is ${(holiday as { name?: string }).name ?? "a public holiday"} — already a day off.`;
  }

  const bal = balanceFor(employeeId, type);
  const need = dayValue(duration);
  if (need > bal.remaining) {
    return `Not enough ${type.toLowerCase()} leave — ${bal.remaining} day${bal.remaining === 1 ? "" : "s"} remaining, this request needs ${need}.`;
  }
  const clash = leaves.some(
    (l) => l.employee === employeeId && l.date === date && l.status !== "Rejected"
  );
  if (clash) return "This employee already has a leave request on that date.";
  return null;
}
