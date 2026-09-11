import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  BusinessRuleError, ConflictError, ForbiddenError, NotFoundError,
} from '../../common/errors/domain.error';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';
import type {
  CreateLeaveDto, DecideLeaveDto, LeaveQueryDto, UpdateLeaveDto,
} from './dto/peopleops.dto';

type Row = { id: string };

/**
 * Leave.
 *
 * Entitlement is the part that has to be right. The frontend hardcoded ten days
 * of each type for everyone and enforced the balance in the browser, where it
 * could be skipped entirely. Here the quota is a per-employee, per-year row and
 * every transition that touches it takes a row lock first.
 */
@Injectable()
export class LeaveService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'leaveRequest', ['reason'], ['startsOn', 'createdAt', 'status'], 'Leave request');
  }

  protected override buildFilters(query: LeaveQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.leaveTypeId) where.leaveTypeId = query.leaveTypeId;
    if (query.from || query.to) {
      where.startsOn = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    return where;
  }

  protected override listInclude() {
    return {
      employee: { select: { id: true, name: true, employeeCode: true } },
      leaveType: { select: { id: true, name: true, paid: true } },
    };
  }

  /* --------------------------------------------------------- balances */

  /**
   * Remaining entitlement per type, for everyone.
   *
   * One row per employee per leave type, so an HR screen can show the whole
   * company's quotas without a request per person.
   */
  async allBalances(year = new Date().getFullYear()) {
    const [employees, types, balances] = await Promise.all([
      this.prisma.db.employee.findMany({
        where: { status: { not: 'EXITED' } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.db.leaveType.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.db.leaveBalance.findMany({ where: { year } }),
    ]);

    const byKey = new Map(balances.map((b) => [`${b.employeeId}:${b.leaveTypeId}`, b]));

    return employees.flatMap((employee) =>
      types.map((type) => {
        const row = byKey.get(`${employee.id}:${type.id}`);
        const quota = Number(row?.quota ?? type.defaultQuota);
        const used = Number(row?.used ?? 0);
        const pending = Number(row?.pending ?? 0);
        return {
          // Synthetic id: a balance that has never been written has no row of
          // its own, but the list still needs a stable key.
          id: row?.id ?? `${employee.id}:${type.id}`,
          employeeId: employee.id,
          employeeName: employee.name,
          leaveTypeId: type.id,
          name: type.name,
          paid: type.paid,
          quota,
          used,
          pending,
          remaining: round1(Math.max(0, quota - used - pending)),
        };
      }),
    );
  }

  /** The employee record behind a login, if there is one. */
  async employeeIdForUser(userId: string): Promise<string | null> {
    const employee = await this.prisma.db.employee.findFirst({
      where: { userId },
      select: { id: true },
    });
    return employee?.id ?? null;
  }

  /**
   * Remaining entitlement per type for one employee in a given year.
   *
   * Same row shape as `allBalances`, deliberately: the caller of
   * `/leave/balances` gets one list or the other depending on what they may
   * see, and a client should not have to tell which it received.
   */
  async balances(employeeId: string, year = new Date().getFullYear()) {
    const [employee, types, balances] = await Promise.all([
      this.prisma.db.employee.findFirst({
        where: { id: employeeId },
        select: { id: true, name: true },
      }),
      this.prisma.db.leaveType.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.db.leaveBalance.findMany({ where: { employeeId, year } }),
    ]);

    const byType = new Map(balances.map((b) => [b.leaveTypeId, b]));

    return types.map((type) => {
      const row = byType.get(type.id);
      const quota = Number(row?.quota ?? type.defaultQuota);
      const used = Number(row?.used ?? 0);
      const pending = Number(row?.pending ?? 0);
      return {
        // A balance that has never been written has no row of its own, but the
        // list still needs a stable key.
        id: row?.id ?? `${employeeId}:${type.id}`,
        employeeId,
        employeeName: employee?.name ?? '',
        leaveTypeId: type.id,
        name: type.name,
        paid: type.paid,
        quota,
        used,
        pending,
        // Pending requests hold entitlement, so two requests cannot both be
        // approved against the same remaining day.
        remaining: round1(Math.max(0, quota - used - pending)),
      };
    });
  }

  /* ---------------------------------------------------------- request */

  /**
   * Raise a request. The days are counted server-side and checked against the
   * balance under a lock, so a client cannot ask for more than it holds by
   * editing the payload or racing a second tab.
   */
  async request(dto: CreateLeaveDto) {
    const startsOn = new Date(dto.startsOn);
    const endsOn = new Date(dto.endsOn ?? dto.startsOn);

    if (endsOn < startsOn) {
      throw new BusinessRuleError('INVALID_RANGE', 'The end date cannot be before the start date');
    }

    const days = dto.halfDay ? 0.5 : countDays(startsOn, endsOn);
    if (dto.halfDay && startsOn.getTime() !== endsOn.getTime()) {
      throw new BusinessRuleError('INVALID_HALF_DAY', 'A half day must start and end on the same date');
    }

    const year = startsOn.getFullYear();

    const created = await this.prisma.transaction(async (tx) => {
      const employee = await tx.employee.findFirst({ where: { id: dto.employeeId } });
      if (!employee) throw new NotFoundError('Employee', dto.employeeId);

      const leaveType = await tx.leaveType.findFirst({ where: { id: dto.leaveTypeId } });
      if (!leaveType) throw new NotFoundError('Leave type', dto.leaveTypeId);

      // Overlap check: two approved or pending requests must not cover the
      // same dates for one person.
      const clash = await tx.leaveRequest.findFirst({
        where: {
          employeeId: dto.employeeId,
          status: { in: ['PENDING', 'APPROVED'] },
          startsOn: { lte: endsOn },
          endsOn: { gte: startsOn },
        },
      });
      if (clash) {
        throw new ConflictError(
          'LEAVE_OVERLAP',
          'You already have leave booked or requested that overlaps these dates',
        );
      }

      const balance = await this.lockBalance(tx, dto.employeeId, dto.leaveTypeId, year, leaveType.defaultQuota);
      const remaining = Number(balance.quota) - Number(balance.used) - Number(balance.pending);

      if (days > remaining + 0.001) {
        throw new BusinessRuleError(
          'INSUFFICIENT_LEAVE_BALANCE',
          `Not enough ${leaveType.name.toLowerCase()} leave — ${round1(remaining)} day(s) remaining, ` +
            `this request needs ${days}.`,
        );
      }

      // Pending consumes entitlement immediately.
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pending: new Prisma.Decimal(Number(balance.pending) + days) },
      });

      return tx.leaveRequest.create({
        data: {
          ...orgScope(),
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          startsOn,
          endsOn,
          days: new Prisma.Decimal(days),
          halfDay: dto.halfDay ?? false,
          reason: dto.reason ?? null,
        },
        include: this.listInclude() as never,
      });
    });

    await this.audit('CREATE', created.id, `${days} day(s) requested`, undefined, created);
    return created;
  }

  /* ----------------------------------------------------------- decide */

  /**
   * Approve or reject. Moves the days from pending to used (or releases them),
   * under the same lock the request took.
   */
  async decide(id: string, dto: DecideLeaveDto) {
    const ctx = getTenantContext();

    const result = await this.prisma.transaction(async (tx) => {
      const request = await tx.leaveRequest.findFirst({
        where: { id },
        include: { leaveType: true, employee: { select: { id: true, name: true, reportsToId: true } } },
      });
      if (!request) throw new NotFoundError('Leave request', id);

      if (request.status !== 'PENDING') {
        throw new ConflictError(
          'ALREADY_DECIDED',
          `This request was already ${request.status.toLowerCase()}`,
        );
      }

      // Nobody approves their own leave, whatever permissions they hold.
      const approverEmployee = await tx.employee.findFirst({
        where: { userId: ctx?.userId ?? '' },
        select: { id: true },
      });
      if (approverEmployee?.id === request.employeeId) {
        throw new ForbiddenError('You cannot approve your own leave request', 'SELF_APPROVAL');
      }

      const year = request.startsOn.getFullYear();
      const balance = await this.lockBalance(
        tx, request.employeeId, request.leaveTypeId, year, request.leaveType.defaultQuota,
      );

      const days = Number(request.days);
      const approved = dto.decision === 'APPROVED';

      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: {
          // Either way the pending hold is released.
          pending: new Prisma.Decimal(Math.max(0, Number(balance.pending) - days)),
          ...(approved ? { used: new Prisma.Decimal(Number(balance.used) + days) } : {}),
        },
      });

      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: dto.decision,
          decidedById: ctx?.userId ?? null,
          decidedAt: new Date(),
          decisionNote: dto.note ?? null,
        },
        include: this.listInclude() as never,
      });
    });

    await this.audit(
      dto.decision === 'APPROVED' ? 'APPROVE' : 'REJECT',
      id,
      `${dto.decision.toLowerCase()} — ${(result as any).employee?.name ?? ''}`,
      undefined,
      result,
    );
    return result;
  }

  /** Cancel a pending request and release the hold. */
  async cancel(id: string) {
    return this.prisma.transaction(async (tx) => {
      const request = await tx.leaveRequest.findFirst({
        where: { id },
        include: { leaveType: true },
      });
      if (!request) throw new NotFoundError('Leave request', id);
      if (request.status !== 'PENDING') {
        throw new ConflictError('NOT_PENDING', 'Only a pending request can be cancelled');
      }

      const year = request.startsOn.getFullYear();
      const balance = await this.lockBalance(
        tx, request.employeeId, request.leaveTypeId, year, request.leaveType.defaultQuota,
      );

      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: {
          pending: new Prisma.Decimal(Math.max(0, Number(balance.pending) - Number(request.days))),
        },
      });

      return tx.leaveRequest.delete({ where: { id } });
    });
  }

  /* -------------------------------------------------------- internals */

  /**
   * Fetch the balance row `FOR UPDATE`, creating it on first use.
   *
   * The lock is the point. Two approvals arriving together would otherwise both
   * read the same `used` value and both succeed, letting an employee overdraw
   * their entitlement — a transaction alone does not prevent that under READ
   * COMMITTED, which is Postgres's default.
   */
  private async lockBalance(
    tx: any,
    employeeId: string,
    leaveTypeId: string,
    year: number,
    defaultQuota: Prisma.Decimal,
  ) {
    const existing = await tx.leaveBalance.findFirst({
      where: { employeeId, leaveTypeId, year },
      select: { id: true },
    });

    if (!existing) {
      return tx.leaveBalance.create({
        data: { employeeId, leaveTypeId, year, quota: defaultQuota },
      });
    }

    // Prisma has no `FOR UPDATE`, so take the lock with raw SQL and then read
    // the row through the client for typing.
    await tx.$queryRaw`SELECT id FROM leave_balances WHERE id = ${existing.id}::uuid FOR UPDATE`;
    return tx.leaveBalance.findFirstOrThrow({ where: { id: existing.id } });
  }
}

/* ---------------------------------------------------------------- helpers */

/** Inclusive whole-day count, weekends included — holidays are a separate rule. */
function countDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
