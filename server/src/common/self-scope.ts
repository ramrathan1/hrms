import { getTenantContext } from '../infra/tenant/tenant-context';

/**
 * Acting for yourself, or for someone else.
 *
 * Several endpoints take an `employeeId` so that a manager or HR can act on a
 * colleague's record — mark attendance, log time against a task, file leave.
 * Taken on trust, that same field lets anyone with the ordinary create
 * permission write into a colleague's record: clock a co-worker in, spend their
 * leave, put hours on their timesheet.
 *
 * So the rule is: you may always act for yourself, and for anyone else only
 * with the permission that marks someone who manages other people's records.
 * Which permission that is differs per module, so the caller names it.
 */

/** Does the caller hold any of these permissions? Wildcards count. */
export function holdsAny(...keys: string[]): boolean {
  const ctx = getTenantContext();
  // Jobs, the seed and the CLI run outside a request on purpose.
  if (!ctx) return true;
  if (ctx.permissions.includes('*')) return true;

  return keys.some((key) => {
    if (ctx.permissions.includes(key)) return true;
    const [module] = key.split(':');
    return ctx.permissions.includes(`${module}:*`);
  });
}

/** The signed-in user's id, or '' outside a request. */
export const currentUserId = (): string => getTenantContext()?.userId ?? '';

/* ------------------------------------------------------------ whose records */

/**
 * How much of the workforce the caller may read.
 *
 * Module permissions answer "may you open the attendance screen"; they cannot
 * answer "whose attendance". Both an employee and their manager hold
 * `attendance:read`, so every list endpoint that hung off it returned the whole
 * company — one employee could read a colleague's clock-in times, leave
 * reasons, documents and tickets.
 *
 * Reach over other people is its own right, so it is its own permission:
 *   people:all   every person's records   (Owner, HR, Manager, Accountant)
 *   people:team  yourself and your direct reports (Team Leader)
 *   neither      yourself
 */
export type PeopleScope = 'all' | 'team' | 'self';

export function peopleScope(): PeopleScope {
  // Jobs, the seed and the CLI run outside a request on purpose.
  if (!getTenantContext()) return 'all';
  if (holdsAny('people:all')) return 'all';
  if (holdsAny('people:team')) return 'team';
  return 'self';
}

/**
 * A Prisma filter for any model that hangs off an employee — attendance, leave,
 * payslips, documents. Spread it into `where`.
 */
export function employeeScope(relation = 'employee'): Record<string, unknown> {
  const scope = peopleScope();
  if (scope === 'all') return {};
  const userId = currentUserId();
  return {
    [relation]:
      scope === 'team'
        ? { OR: [{ userId }, { reportsTo: { userId } }] }
        : { userId },
  };
}

/** The same rule applied to the Employee model itself. */
export function employeeSelfScope(): Record<string, unknown> {
  const scope = peopleScope();
  if (scope === 'all') return {};
  const userId = currentUserId();
  return scope === 'team'
    ? { OR: [{ userId }, { reportsTo: { userId } }] }
    : { userId };
}

/**
 * For a record that belongs to one login — a notification, a personal todo.
 * There is no "manager view" of these: they are yours, full stop.
 */
export function ownedByMe(field = 'userId'): Record<string, unknown> {
  return { [field]: currentUserId() };
}
