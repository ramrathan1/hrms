import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { employeeScope } from '../../common/self-scope';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/domain.error';
import { orgScope, requireTenantContext } from '../../infra/tenant/tenant-context';
import type {
  AppreciationQueryDto, CreateAppreciationDto, CreateAwardDto, CreateEmergencyContactDto,
  CreateEmployeeDocumentDto, CreateKeyResultDto, CreateObjectiveDto, CreateOvertimeDto,
  CreatePayslipDto, CreateReviewMeetingDto, CreateSalaryDto, DecideDto,
  EmployeeScopedQueryDto, OvertimeQueryDto, PayslipQueryDto, ReviewMeetingQueryDto,
  SalaryQueryDto, UpdateAwardDto, UpdateEmergencyContactDto, UpdateKeyResultDto,
  UpdateObjectiveDto, UpdateOvertimeDto, UpdateReviewMeetingDto,
} from './dto/people.dto';

type Row = { id: string };

/* ------------------------------------------------------------- salaries */

/**
 * Pay, and the trail of how it got there.
 *
 * A raise is not an edit. Setting a new salary closes the old row and writes a
 * SalaryChange, so "what were they on in March" always has an answer — an
 * in-place update would erase exactly the history payroll disputes turn on.
 */
@Injectable()
export class SalariesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'salary', [], ['effectiveFrom', 'annualAmount'], 'Salary');
  }

  protected override buildFilters(query: SalaryQueryDto) {
    return query.employeeId ? { employeeId: query.employeeId } : {};
  }

  protected override scopeFilter() {
    return employeeScope();
  }

  protected override listInclude() {
    return { employee: { select: { id: true, name: true, employeeCode: true } } };
  }

  /** The salary in force for each employee right now. */
  async current(employeeIds?: string[]) {
    const rows = await this.prisma.db.salary.findMany({
      where: {
        effectiveTo: null,
        ...(employeeIds?.length ? { employeeId: { in: employeeIds } } : {}),
      },
      include: { employee: { select: { id: true, name: true, employeeCode: true } } },
      orderBy: { effectiveFrom: 'desc' },
    });
    return rows;
  }

  async setSalary(dto: CreateSalaryDto) {
    return this.prisma.transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: dto.employeeId },
        select: { id: true, name: true },
      });
      if (!employee) throw new NotFoundError('Employee', dto.employeeId);

      const effectiveFrom = new Date(dto.effectiveFrom);
      const open = await tx.salary.findFirst({
        where: { employeeId: dto.employeeId, effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (open) {
        if (effectiveFrom <= open.effectiveFrom) {
          throw new BusinessRuleError(
            'NOT_LATER',
            'A new salary has to start after the one it replaces',
          );
        }
        // Close the previous band the day before the new one starts.
        const closesOn = new Date(effectiveFrom);
        closesOn.setDate(closesOn.getDate() - 1);
        await tx.salary.update({ where: { id: open.id }, data: { effectiveTo: closesOn } });

        await tx.salaryChange.create({
          data: {
            ...orgScope(),
            employeeId: dto.employeeId,
            fromAmount: open.annualAmount,
            toAmount: new Prisma.Decimal(dto.annualAmount),
            effectiveOn: effectiveFrom,
            note: dto.note ?? null,
          },
        });
      }

      const created = await tx.salary.create({
        data: {
          ...orgScope(),
          employeeId: dto.employeeId,
          annualAmount: new Prisma.Decimal(dto.annualAmount),
          currency: dto.currency ?? 'USD',
          effectiveFrom,
        },
        include: { employee: { select: { id: true, name: true, employeeCode: true } } },
      });

      await this.audit('UPDATE', created.id, `${employee.name} salary set`);
      return created;
    });
  }
}

@Injectable()
export class SalaryChangesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'salaryChange', ['note'], ['effectiveOn'], 'Salary change');
  }

  protected override buildFilters(query: EmployeeScopedQueryDto) {
    return query.employeeId ? { employeeId: query.employeeId } : {};
  }

  protected override scopeFilter() {
    return employeeScope();
  }

  protected override listInclude() {
    return { employee: { select: { id: true, name: true } } };
  }
}

/* ------------------------------------------------------------- payslips */

@Injectable()
export class PayslipsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'payslip', [], ['periodStart', 'net'], 'Payslip');
  }

  protected override buildFilters(query: PayslipQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    return where;
  }

  protected override scopeFilter() {
    return employeeScope();
  }

  protected override listInclude() {
    return { employee: { select: { id: true, name: true, employeeCode: true } } };
  }

  /**
   * Draft a payslip. Gross comes from the salary in force during the period,
   * not from whatever the caller typed, unless they deliberately override it.
   */
  async draft(dto: CreatePayslipDto) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (periodEnd < periodStart) {
      throw new BusinessRuleError('BAD_PERIOD', 'The period ends before it starts');
    }

    const clash = await this.prisma.db.payslip.findFirst({
      where: { employeeId: dto.employeeId, periodStart, periodEnd },
      select: { id: true },
    });
    if (clash) throw new ConflictError('ALREADY_DRAFTED', 'A payslip already covers that period');

    let gross = dto.gross;
    if (gross == null) {
      const salary = await this.prisma.db.salary.findFirst({
        where: {
          employeeId: dto.employeeId,
          effectiveFrom: { lte: periodEnd },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (!salary) {
        throw new BusinessRuleError(
          'NO_SALARY',
          'This employee has no salary on record for that period. Set one first.',
        );
      }
      // Monthly slice of the annual figure.
      gross = Math.round((Number(salary.annualAmount) / 12) * 100) / 100;
    }

    const deductions = dto.deductions ?? 0;
    return this.create({
      ...orgScope(),
      employeeId: dto.employeeId,
      periodStart,
      periodEnd,
      gross: new Prisma.Decimal(gross),
      deductions: new Prisma.Decimal(deductions),
      net: new Prisma.Decimal(Math.round((gross - deductions) * 100) / 100),
      status: 'DRAFT',
    });
  }

  /** Mark a slip paid. Only ever forwards — a paid slip is a record. */
  async markPaid(id: string) {
    const slip = await this.prisma.db.payslip.findFirst({ where: { id } });
    if (!slip) throw new NotFoundError('Payslip', id);
    if (slip.status === 'PAID') throw new ConflictError('ALREADY_PAID', 'This payslip is settled');

    const updated = await this.prisma.db.payslip.update({
      where: { id },
      data: { status: 'PAID', paidOn: new Date() },
      include: this.listInclude() as never,
    });
    await this.audit('PAYMENT', id, `Payslip paid`);
    return updated;
  }
}

/* ------------------------------------------------------------- overtime */

@Injectable()
export class OvertimeService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'overtimeRequest', ['reason'], ['workedOn', 'hours'], 'Overtime request');
  }

  protected override buildFilters(query: OvertimeQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    return where;
  }

  protected override scopeFilter() {
    return employeeScope();
  }

  protected override listInclude() {
    return { employee: { select: { id: true, name: true, employeeCode: true } } };
  }

  createRequest(dto: CreateOvertimeDto) {
    return this.create({
      ...orgScope(),
      employeeId: dto.employeeId,
      workedOn: new Date(dto.workedOn),
      hours: new Prisma.Decimal(dto.hours),
      reason: dto.reason ?? null,
    });
  }

  updateRequest(id: string, dto: UpdateOvertimeDto) {
    return this.update(id, {
      ...(dto.workedOn ? { workedOn: new Date(dto.workedOn) } : {}),
      ...(dto.hours !== undefined ? { hours: new Prisma.Decimal(dto.hours) } : {}),
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
    });
  }

  /** Approve or reject. Nobody signs off their own overtime. */
  async decide(id: string, dto: DecideDto) {
    const ctx = requireTenantContext();
    const request = await this.prisma.db.overtimeRequest.findFirst({ where: { id } });
    if (!request) throw new NotFoundError('Overtime request', id);
    if (request.status !== 'PENDING') {
      throw new ConflictError('ALREADY_DECIDED', `Already ${request.status.toLowerCase()}`);
    }

    const own = await this.prisma.db.employee.findFirst({
      where: { userId: ctx.userId },
      select: { id: true },
    });
    if (own && own.id === request.employeeId) {
      throw new ForbiddenError('You cannot approve your own overtime', 'SELF_APPROVAL');
    }

    const updated = await this.prisma.db.overtimeRequest.update({
      where: { id },
      data: { status: dto.decision, decidedById: ctx.userId, decidedAt: new Date() },
      include: this.listInclude() as never,
    });
    await this.audit(dto.decision === 'APPROVED' ? 'APPROVE' : 'REJECT', id, 'Overtime');
    return updated;
  }
}

/* ---------------------------------------------------------- performance */

/**
 * Objectives and their key results.
 *
 * Progress is computed from the key results rather than typed, so the number on
 * the objective can never contradict the results underneath it.
 */
@Injectable()
export class ObjectivesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'objective', ['title', 'description'], ['periodEnd', 'createdAt'], 'Objective');
  }

  /* An objective belongs to one person; a colleague's goals are not yours
     to read. `employeeId` is nullable — a company-wide objective has none. */
  protected override buildFilters(query: EmployeeScopedQueryDto) {
    return query.employeeId ? { employeeId: query.employeeId } : {};
  }

  protected override scopeFilter() {
    const scope = employeeScope();
    // `employeeId` is nullable — a company-wide objective belongs to no one.
    return Object.keys(scope).length ? { OR: [scope, { employeeId: null }] } : {};
  }

  protected override listInclude() {
    return {
      keyResults: true,
      employee: { select: { id: true, name: true } },
    };
  }

  createObjective(dto: CreateObjectiveDto) {
    return this.create({
      ...orgScope(),
      title: dto.title,
      description: dto.description ?? null,
      kind: dto.kind ?? 'Team',
      employeeId: dto.employeeId ?? null,
      priority: dto.priority ?? 'Medium',
      checkinCadence: dto.checkinCadence ?? 'Monthly',
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
    });
  }

  updateObjective(id: string, dto: UpdateObjectiveDto) {
    return this.update(id, {
      ...(dto.title ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.kind ? { kind: dto.kind } : {}),
      ...(dto.employeeId !== undefined ? { employeeId: dto.employeeId ?? null } : {}),
      ...(dto.priority ? { priority: dto.priority } : {}),
      ...(dto.checkinCadence ? { checkinCadence: dto.checkinCadence } : {}),
      ...(dto.periodStart ? { periodStart: new Date(dto.periodStart) } : {}),
      ...(dto.periodEnd ? { periodEnd: new Date(dto.periodEnd) } : {}),
    });
  }

  /** Recompute an objective's progress from its key results. */
  async recompute(objectiveId: string) {
    const results = await this.prisma.db.keyResult.findMany({ where: { objectiveId } });
    if (!results.length) return;

    const pct =
      results.reduce((total, kr) => {
        const target = Number(kr.target);
        // A key result with no target is either done or not — there is no
        // meaningful percentage between the two.
        if (target <= 0) return total + (Number(kr.current) > 0 ? 100 : 0);
        return total + Math.min(100, (Number(kr.current) / target) * 100);
      }, 0) / results.length;

    await this.prisma.db.objective.update({
      where: { id: objectiveId },
      data: { progress: Math.round(pct) },
    });
  }
}

@Injectable()
export class KeyResultsService extends BaseCrudService<Row> {
  constructor(
    prisma: PrismaService,
    private readonly objectives: ObjectivesService,
  ) {
    super(prisma, 'keyResult', ['title'], ['title'], 'Key result');
  }

  async createResult(dto: CreateKeyResultDto) {
    const objective = await this.prisma.db.objective.findFirst({
      where: { id: dto.objectiveId },
      select: { id: true },
    });
    if (!objective) throw new NotFoundError('Objective', dto.objectiveId);

    const created = await this.create({
      objectiveId: dto.objectiveId,
      title: dto.title,
      target: new Prisma.Decimal(dto.target ?? 100),
      current: new Prisma.Decimal(dto.current ?? 0),
      unit: dto.unit ?? null,
    });
    await this.objectives.recompute(dto.objectiveId);
    return created;
  }

  async updateResult(id: string, dto: UpdateKeyResultDto) {
    const updated = (await this.update(id, {
      ...(dto.title ? { title: dto.title } : {}),
      ...(dto.target !== undefined ? { target: new Prisma.Decimal(dto.target) } : {}),
      ...(dto.current !== undefined ? { current: new Prisma.Decimal(dto.current) } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
    })) as Row & { objectiveId: string };

    await this.objectives.recompute(updated.objectiveId);
    return updated;
  }

  override async remove(id: string) {
    const row = (await this.findOne(id)) as Row & { objectiveId: string };
    const result = await super.remove(id);
    await this.objectives.recompute(row.objectiveId);
    return result;
  }
}

@Injectable()
export class ReviewMeetingsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'reviewMeeting', ['agenda', 'notes'], ['scheduledAt'], 'Review meeting');
  }

  protected override buildFilters(query: ReviewMeetingQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    return where;
  }

  protected override scopeFilter() {
    return employeeScope();
  }

  protected override listInclude() {
    return { employee: { select: { id: true, name: true, employeeCode: true } } };
  }

  schedule(dto: CreateReviewMeetingDto) {
    const ctx = requireTenantContext();
    return this.create({
      ...orgScope(),
      employeeId: dto.employeeId,
      heldById: ctx.userId,
      scheduledAt: new Date(dto.scheduledAt),
      durationMins: dto.durationMins ?? 30,
      agenda: dto.agenda ?? null,
      status: 'Upcoming',
    });
  }

  updateMeeting(id: string, dto: UpdateReviewMeetingDto) {
    return this.update(id, {
      ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
      ...(dto.durationMins !== undefined ? { durationMins: dto.durationMins } : {}),
      ...(dto.agenda !== undefined ? { agenda: dto.agenda } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.status
        ? { status: dto.status, ...(dto.status === 'Completed' ? { completedAt: new Date() } : {}) }
        : {}),
    });
  }
}

/* ----------------------------------------------------------- recognition */

@Injectable()
export class AwardsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'award', ['name', 'summary'], ['name'], 'Award');
  }

  protected override listInclude() {
    return { _count: { select: { appreciations: true } } };
  }

  async createAward(dto: CreateAwardDto) {
    const clash = await this.prisma.db.award.findFirst({
      where: { name: dto.name },
      select: { id: true },
    });
    if (clash) throw new ConflictError('NAME_TAKEN', `There is already a "${dto.name}" award`);

    return this.create({
      ...orgScope(),
      name: dto.name,
      icon: dto.icon ?? '🏆',
      summary: dto.summary ?? null,
    });
  }

  updateAward(id: string, dto: UpdateAwardDto) {
    return this.update(id, {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.icon ? { icon: dto.icon } : {}),
      ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
    });
  }

  /** Given awards are part of people's records; retiring one keeps them. */
  override async remove(id: string) {
    const given = await this.prisma.db.appreciation.count({ where: { awardId: id } });
    if (given > 0) {
      throw new ConflictError(
        'AWARD_GIVEN',
        `This award has been given ${given} time(s). Removing it would erase those records.`,
      );
    }
    return super.remove(id);
  }
}

@Injectable()
export class AppreciationsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'appreciation', ['note'], ['awardedOn'], 'Appreciation');
  }

  protected override buildFilters(query: AppreciationQueryDto) {
    return query.employeeId ? { employeeId: query.employeeId } : {};
  }

  protected override scopeFilter() {
    return employeeScope();
  }

  protected override listInclude() {
    return {
      employee: { select: { id: true, name: true } },
      award: { select: { id: true, name: true, icon: true } },
    };
  }

  give(dto: CreateAppreciationDto) {
    const ctx = requireTenantContext();
    return this.create({
      ...orgScope(),
      employeeId: dto.employeeId,
      awardId: dto.awardId ?? null,
      givenById: ctx.userId,
      awardedOn: new Date(dto.awardedOn ?? Date.now()),
      note: dto.note ?? null,
    });
  }
}

/* ------------------------------------------------------- employee file */

@Injectable()
export class EmergencyContactsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'emergencyContact', ['name', 'phone'], ['name'], 'Emergency contact');
  }

  protected override buildFilters(query: EmployeeScopedQueryDto) {
    return query.employeeId ? { employeeId: query.employeeId } : {};
  }

  protected override scopeFilter() {
    return employeeScope();
  }

  /**
   * EmergencyContact hangs off Employee and carries no organizationId, so the
   * tenant extension leaves it alone — the employee lookup below is what keeps
   * one tenant from writing contacts onto another's staff.
   */
  async createContact(dto: CreateEmergencyContactDto) {
    await this.assertEmployee(dto.employeeId);
    return this.create({
      employeeId: dto.employeeId,
      name: dto.name,
      phone: dto.phone,
      relation: dto.relation ?? null,
    });
  }

  async updateContact(id: string, dto: UpdateEmergencyContactDto) {
    await this.assertOurs(id);
    return this.update(id, {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.phone ? { phone: dto.phone } : {}),
      ...(dto.relation !== undefined ? { relation: dto.relation } : {}),
    });
  }

  override async remove(id: string) {
    await this.assertOurs(id);
    return super.remove(id);
  }

  private async assertEmployee(employeeId: string) {
    const employee = await this.prisma.db.employee.findFirst({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundError('Employee', employeeId);
  }

  private async assertOurs(id: string) {
    const row = await this.prisma.db.emergencyContact.findFirst({ where: { id } });
    if (!row) throw new NotFoundError('Emergency contact', id);
    await this.assertEmployee(row.employeeId);
  }
}

@Injectable()
export class EmployeeDocumentsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'employeeDocument', ['name', 'category'], ['issuedOn', 'name'], 'Document');
  }

  protected override buildFilters(query: EmployeeScopedQueryDto) {
    return query.employeeId ? { employeeId: query.employeeId } : {};
  }

  protected override scopeFilter() {
    return employeeScope();
  }

  protected override listInclude() {
    return {
      file: { select: { id: true, fileName: true, sizeBytes: true, mimeType: true } },
      employee: { select: { id: true, name: true } },
    };
  }

  /** Same story as emergency contacts: the employee check is the tenant check. */
  async addDocument(dto: CreateEmployeeDocumentDto) {
    const employee = await this.prisma.db.employee.findFirst({
      where: { id: dto.employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundError('Employee', dto.employeeId);

    if (dto.fileId) {
      const file = await this.prisma.db.attachment.findFirst({
        where: { id: dto.fileId },
        select: { id: true },
      });
      if (!file) throw new NotFoundError('File', dto.fileId);
    }

    return this.create({
      employeeId: dto.employeeId,
      name: dto.name,
      category: dto.category ?? null,
      fileId: dto.fileId ?? null,
      issuedOn: dto.issuedOn ? new Date(dto.issuedOn) : null,
    });
  }

  override async remove(id: string) {
    const row = await this.prisma.db.employeeDocument.findFirst({ where: { id } });
    if (!row) throw new NotFoundError('Document', id);
    const employee = await this.prisma.db.employee.findFirst({
      where: { id: row.employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundError('Document', id);
    return super.remove(id);
  }
}
