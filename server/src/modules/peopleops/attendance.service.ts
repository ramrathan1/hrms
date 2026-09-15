import { Injectable } from '@nestjs/common';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/domain.error';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';
import type {
  AttendanceQueryDto, ClockDto, MarkAttendanceDto, MonthlyGridQueryDto,
} from './dto/peopleops.dto';
import { isWeeklyOff } from '../../common/work-calendar';
import { currentUserId, employeeScope, employeeSelfScope, holdsAny } from '../../common/self-scope';

type Row = { id: string };

/**
 * Attendance.
 *
 * This replaces a formula. The frontend generated attendance deterministically
 * from an employee index and a date, while Clock In wrote real events to a
 * collection no screen ever read — so genuine attendance was captured and then
 * lost. Here the record is the source of truth, and the grid reads it.
 */
@Injectable()
export class AttendanceService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'attendanceRecord', ['note'], ['workDate', 'createdAt'], 'Attendance record');
  }

  /* When somebody arrived and left is their record, not the office's. HR and
     managers see everyone, a team leader their team, everyone else their own —
     on the list and on a read by id alike. */
  protected override scopeFilter() {
    return employeeScope();
  }

  protected override buildFilters(query: AttendanceQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.workDate = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    return where;
  }

  protected override listInclude() {
    return { employee: { select: { id: true, name: true, employeeCode: true } } };
  }

  /* ------------------------------------------------------------ clock */

  /**
   * Clock in. Idempotent by construction: one row per employee per day, so a
   * double tap updates rather than duplicating.
   */
  async clockIn(dto: ClockDto) {
    const employee = await this.resolveEmployee(dto.employeeId);
    const workDate = startOfDay(dto.at ? new Date(dto.at) : new Date());
    const at = dto.at ? new Date(dto.at) : new Date();

    const existing = await this.prisma.db.attendanceRecord.findFirst({
      where: { employeeId: employee.id, workDate },
    });

    if (existing?.clockInAt) {
      throw new ConflictError(
        'ALREADY_CLOCKED_IN',
        `Already clocked in today at ${existing.clockInAt.toISOString().slice(11, 16)}`,
      );
    }

    /* A day cannot be both taken as leave and worked. Clocking in on approved
       leave wrote a PRESENT — or, past the grace period, a LATE — onto a day
       the same database says the person is off, and the two records then
       disagree about whether they were at work. A half day is left alone:
       that is exactly the case where somebody works the other half. */
    const leave = await this.fullDayLeaveOn(employee.id, workDate);
    if (leave) {
      throw new ConflictError(
        'ON_APPROVED_LEAVE',
        'You are on approved leave today. Cancel the leave first if you are working.',
      );
    }

    const status = await this.deriveStatus(employee.id, workDate, at);

    const record = existing
      ? await this.prisma.db.attendanceRecord.update({
          where: { id: existing.id },
          data: { clockInAt: at, status, location: dto.location ?? null },
        })
      : await this.prisma.db.attendanceRecord.create({
          data: {
            ...orgScope(),
            employeeId: employee.id,
            workDate,
            clockInAt: at,
            status,
            location: dto.location ?? null,
          },
        });

    await this.audit('CREATE', record.id, `Clocked in`, undefined, record);
    return record;
  }

  async clockOut(dto: ClockDto) {
    const employee = await this.resolveEmployee(dto.employeeId);
    const workDate = startOfDay(dto.at ? new Date(dto.at) : new Date());
    const at = dto.at ? new Date(dto.at) : new Date();

    const existing = await this.prisma.db.attendanceRecord.findFirst({
      where: { employeeId: employee.id, workDate },
    });
    if (!existing?.clockInAt) {
      throw new ConflictError('NOT_CLOCKED_IN', 'You have not clocked in today');
    }
    if (existing.clockOutAt) {
      throw new ConflictError('ALREADY_CLOCKED_OUT', 'You have already clocked out today');
    }

    const record = await this.prisma.db.attendanceRecord.update({
      where: { id: existing.id },
      data: { clockOutAt: at },
    });
    await this.audit('UPDATE', record.id, 'Clocked out', existing, record);
    return record;
  }

  /** Today's record for the signed-in user, for the topbar widget. */
  async today(employeeId?: string) {
    const employee = await this.resolveEmployee(employeeId);
    const workDate = startOfDay(new Date());
    const [record, leave] = await Promise.all([
      this.prisma.db.attendanceRecord.findFirst({
        where: { employeeId: employee.id, workDate },
      }),
      this.fullDayLeaveOn(employee.id, workDate),
    ]);
    return {
      employeeId: employee.id,
      workDate,
      clockedIn: Boolean(record?.clockInAt && !record?.clockOutAt),
      // So the screen can say why the button is unavailable, instead of
      // offering it and answering the press with an error.
      onLeave: Boolean(leave),
      leaveLabel: leave?.leaveType?.name ?? null,
      record,
    };
  }

  /* ------------------------------------------------- manual marking */

  /** HR correcting the record — always audited, never silent. */
  async mark(dto: MarkAttendanceDto) {
    const workDate = startOfDay(new Date(dto.workDate));
    const existing = await this.prisma.db.attendanceRecord.findFirst({
      where: { employeeId: dto.employeeId, workDate },
    });

    const data = {
      status: dto.status,
      clockInAt: dto.clockInAt ? new Date(dto.clockInAt) : null,
      clockOutAt: dto.clockOutAt ? new Date(dto.clockOutAt) : null,
      note: dto.note ?? null,
    };

    const record = existing
      ? await this.prisma.db.attendanceRecord.update({ where: { id: existing.id }, data })
      : await this.prisma.db.attendanceRecord.create({
          data: { ...orgScope(), employeeId: dto.employeeId, workDate, ...data },
        });

    await this.audit('UPDATE', record.id, `Marked ${dto.status}`, existing ?? undefined, record);
    return record;
  }

  /* ---------------------------------------------------- monthly grid */

  /**
   * The grid HR reads: one row per employee, one cell per day of the month.
   *
   * Days with no record are resolved rather than left blank — a weekend is a
   * weekend, a holiday is a holiday, and approved leave shows as leave. Only a
   * working day with no record counts as absent.
   */
  async monthlyGrid(query: MonthlyGridQueryDto) {
    const year = query.year;
    const month = query.month; // 1-12
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0));
    const dayCount = to.getUTCDate();

    const [employees, records, holidays, approvedLeave] = await Promise.all([
      this.prisma.db.employee.findMany({
        where: {
          status: 'ACTIVE',
          ...(query.departmentId ? { departmentId: query.departmentId } : {}),
          /* Whose rows this grid shows. Correcting attendance is HR's job and
             a right over other people's records, not a screen permission. */
          ...employeeSelfScope(),
        },
        select: { id: true, name: true, employeeCode: true, departmentId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.db.attendanceRecord.findMany({
        where: { workDate: { gte: from, lte: to } },
      }),
      this.prisma.db.holiday.findMany({ where: { holidayOn: { gte: from, lte: to } } }),
      this.prisma.db.leaveRequest.findMany({
        where: { status: 'APPROVED', startsOn: { lte: to }, endsOn: { gte: from } },
        select: { employeeId: true, startsOn: true, endsOn: true },
      }),
    ]);

    const recordKey = (employeeId: string, day: number) => `${employeeId}:${day}`;
    const byKey = new Map(
      records.map((r) => [recordKey(r.employeeId, r.workDate.getUTCDate()), r]),
    );
    const holidayDays = new Set(holidays.map((h) => h.holidayOn.getUTCDate()));

    const onLeave = new Set<string>();
    for (const leave of approvedLeave) {
      for (let d = 1; d <= dayCount; d++) {
        const day = new Date(Date.UTC(year, month - 1, d));
        if (day >= startOfDay(leave.startsOn) && day <= startOfDay(leave.endsOn)) {
          onLeave.add(recordKey(leave.employeeId, d));
        }
      }
    }

    const today = startOfDay(new Date());

    const rows = employees.map((employee) => {
      const days: { day: number; status: string }[] = [];
      let present = 0;
      let working = 0;

      for (let d = 1; d <= dayCount; d++) {
        const date = new Date(Date.UTC(year, month - 1, d));
        const key = recordKey(employee.id, d);
        const record = byKey.get(key);

        let status: string;
        if (record) status = record.status;
        else if (isWeeklyOff(date)) status = 'WEEKEND';
        else if (holidayDays.has(d)) status = 'HOLIDAY';
        else if (onLeave.has(key)) status = 'ON_LEAVE';
        else if (date > today) status = 'PENDING';
        else status = 'ABSENT';

        if (!['WEEKEND', 'HOLIDAY', 'PENDING'].includes(status)) working += 1;
        if (['PRESENT', 'LATE', 'HALF_DAY'].includes(status)) present += 1;

        days.push({ day: d, status });
      }

      return {
        employeeId: employee.id,
        name: employee.name,
        employeeCode: employee.employeeCode,
        days,
        summary: {
          present,
          workingDays: working,
          percent: working > 0 ? Math.round((present / working) * 100) : 0,
        },
      };
    });

    return { year, month, dayCount, rows };
  }

  /* -------------------------------------------------------- internals */

  /** Falls back to the signed-in user's own employee record. */
  private async resolveEmployee(employeeId?: string) {
    if (employeeId) {
      const employee = await this.prisma.db.employee.findFirst({ where: { id: employeeId } });
      if (!employee) throw new NotFoundError('Employee', employeeId);

      /* Clocking somebody else in is falsifying their attendance, and the id
         arrives in the request body — so it cannot be taken on trust. Correcting
         another person's record is HR's job and carries attendance:update. */
      if (employee.userId !== currentUserId() && !holdsAny('attendance:update')) {
        throw new ForbiddenError(
          'You can only clock yourself in and out.',
          'NOT_YOUR_ATTENDANCE',
        );
      }
      return employee;
    }
    const ctx = getTenantContext();
    const own = await this.prisma.db.employee.findFirst({ where: { userId: ctx?.userId ?? '' } });
    if (!own) {
      throw new NotFoundError(
        'Employee record for the signed-in user — pass employeeId, or link this account to an employee',
      );
    }
    return own;
  }

  /** Approved leave covering a whole working day, if there is one. */
  private async fullDayLeaveOn(employeeId: string, workDate: Date) {
    return this.prisma.db.leaveRequest.findFirst({
      where: {
        employeeId,
        status: 'APPROVED',
        halfDay: false,
        startsOn: { lte: workDate },
        endsOn: { gte: workDate },
      },
      select: { id: true, startsOn: true, endsOn: true, leaveType: { select: { name: true } } },
    });
  }

  /** Late is a shift rule, not a guess: after the shift start plus grace. */
  private async deriveStatus(
    _employeeId: string,
    _workDate: Date,
    at: Date,
  ): Promise<'PRESENT' | 'LATE'> {
    const shift = await this.prisma.db.shift.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!shift) return 'PRESENT';

    const [h, m] = shift.startsAt.split(':').map(Number);
    if (Number.isNaN(h)) return 'PRESENT';

    const graceMinutes = 15;
    const cutoff = new Date(at);
    cutoff.setHours(h, (m || 0) + graceMinutes, 0, 0);
    return at > cutoff ? 'LATE' : 'PRESENT';
  }
}

const startOfDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
