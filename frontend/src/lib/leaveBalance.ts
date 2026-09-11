/* Leave entitlement engine: per-type quotas, days taken, pending, and remaining.
   Used to show balances and to block requests that exceed entitlement. */
import { leaves } from "@/data/hr";

export const LEAVE_QUOTA: Record<string, number> = { Casual: 10, Sick: 10, Earned: 10 };
export const LEAVE_TYPES = Object.keys(LEAVE_QUOTA);

const dayValue = (duration: string) => (duration === "Full Day" ? 1 : 0.5);

export type Balance = { type: string; quota: number; taken: number; pending: number; remaining: number };

export function balanceFor(employeeId: string, type: string): Balance {
  const mine = leaves.filter((l) => l.employee === employeeId && l.type === type);
  const taken = mine.filter((l) => l.status === "Approved").reduce((a, l) => a + dayValue(l.duration), 0);
  const pending = mine.filter((l) => l.status === "Pending").reduce((a, l) => a + dayValue(l.duration), 0);
  const quota = LEAVE_QUOTA[type] ?? 0;
  return { type, quota, taken, pending, remaining: Math.max(0, quota - taken - pending) };
}

export function allBalances(employeeId: string): Balance[] {
  return LEAVE_TYPES.map((t) => balanceFor(employeeId, t));
}

/** returns an error string when the request cannot be granted */
export function validateLeave(employeeId: string, type: string, duration: string, date: string): string | null {
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
