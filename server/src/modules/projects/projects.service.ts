import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CacheService } from '../../infra/cache/cache.service';
import {
  BusinessRuleError, ConflictError, NotFoundError,
} from '../../common/errors/domain.error';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';
import type {
  CreateMilestoneDto, CreateProjectDto, CreateTaskDto, CreateTimeLogDto,
  ProjectQueryDto, TaskQueryDto, TimeLogQueryDto, UpdateMilestoneDto,
  UpdateProjectDto, UpdateTaskDto,
} from './dto/project.dto';

type Row = { id: string };

/* --------------------------------------------------------------- projects */

@Injectable()
export class ProjectsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService, private readonly cache: CacheService) {
    super(prisma, 'project', ['name', 'code', 'summary'], ['name', 'deadlineOn', 'progress', 'createdAt'], 'Project');
  }

  protected override buildFilters(query: ProjectQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    // "At risk" is derived, so express it as a filter rather than letting each
    // screen invent its own definition.
    if (query.atRisk === 'true') {
      where.deadlineOn = { lt: new Date() };
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
    }
    if (query.memberId) where.members = { some: { userId: query.memberId } };
    return where;
  }

  protected override listInclude() {
    return {
      client: { select: { id: true, name: true, company: true } },
      _count: { select: { tasks: true, milestones: true, members: true } },
    };
  }

  protected override detailInclude() {
    return {
      client: { select: { id: true, name: true, company: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      milestones: { orderBy: { position: 'asc' as const } },
      _count: { select: { tasks: true, invoices: true } },
    };
  }

  async createProject(dto: CreateProjectDto) {
    const code = dto.code ?? (await this.nextCode());
    const created = await this.prisma.transaction(async (tx) =>
      tx.project.create({
        data: {
          ...orgScope(),
          code,
          name: dto.name,
          summary: dto.summary ?? null,
          category: dto.category ?? null,
          clientId: dto.clientId ?? null,
          status: dto.status ?? 'NOT_STARTED',
          startsOn: dto.startsOn ? new Date(dto.startsOn) : null,
          deadlineOn: dto.deadlineOn ? new Date(dto.deadlineOn) : null,
          budget: new Prisma.Decimal(dto.budget ?? 0),
          currency: dto.currency ?? 'USD',
          // Recomputed from the tasks as soon as any exist; this is only the
          // starting point for work imported mid-flight.
          progress: dto.progress ?? 0,
          members: dto.memberIds?.length
            ? { create: dto.memberIds.map((userId) => ({ userId })) }
            : undefined,
        },
        include: this.detailInclude() as never,
      }),
    );
    await this.audit('CREATE', created.id, `${created.code} ${created.name}`, undefined, created);
    return created;
  }

  updateProject(id: string, dto: UpdateProjectDto) {
    return this.update(id, {
      ...dto,
      memberIds: undefined,
      ...(dto.startsOn ? { startsOn: new Date(dto.startsOn) } : {}),
      ...(dto.deadlineOn ? { deadlineOn: new Date(dto.deadlineOn) } : {}),
      ...(dto.budget != null ? { budget: new Prisma.Decimal(dto.budget) } : {}),
    });
  }

  /** Replace the member list wholesale — simpler to reason about than diffing. */
  async setMembers(projectId: string, userIds: string[]) {
    await this.findOne(projectId);
    return this.prisma.transaction(async (tx) => {
      await tx.projectMember.deleteMany({ where: { projectId } });
      if (userIds.length) {
        await tx.projectMember.createMany({
          data: userIds.map((userId) => ({ projectId, userId })),
          skipDuplicates: true,
        });
      }
      return tx.project.findFirstOrThrow({
        where: { id: projectId },
        include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
      });
    });
  }

  /**
   * Budget burn: labour valued at each person's rate, plus approved expenses.
   * The frontend computed this inline in three different places with three
   * slightly different expressions.
   */
  async financials(projectId: string) {
    await this.findOne(projectId);

    const [project, logs, expenses, invoices] = await Promise.all([
      this.prisma.db.project.findFirstOrThrow({ where: { id: projectId } }),
      this.prisma.db.timeLog.findMany({
        where: { projectId },
        include: { employee: { select: { hourlyRate: true } } },
      }),
      this.prisma.db.expense.findMany({ where: { projectId, status: { not: 'REJECTED' } } }),
      this.prisma.db.invoice.findMany({ where: { projectId, status: { not: 'CANCELLED' } } }),
    ]);

    const hours = logs.reduce((a, l) => a + Number(l.hours), 0);
    const labour = logs.reduce((a, l) => a + Number(l.hours) * Number(l.employee.hourlyRate), 0);
    const expenseTotal = expenses.reduce((a, e) => a + Number(e.amount), 0);
    const spent = labour + expenseTotal;
    const budget = Number(project.budget);
    const invoiced = invoices.reduce((a, i) => a + Number(i.total), 0);
    const collected = invoices.reduce((a, i) => a + Number(i.paidAmount), 0);

    return {
      budget,
      spent: round2(spent),
      labour: round2(labour),
      expenses: round2(expenseTotal),
      remaining: round2(budget - spent),
      burnPercent: budget > 0 ? Math.round((spent / budget) * 100) : 0,
      hoursLogged: round2(hours),
      invoiced: round2(invoiced),
      collected: round2(collected),
      margin: round2(invoiced - spent),
    };
  }

  private async nextCode(): Promise<string> {
    const last = await this.prisma.db.project.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });
    const digits = Number(String(last?.code ?? '').replace(/\D/g, '')) || 0;
    return `PRJ${String(digits + 1).padStart(3, '0')}`;
  }
}

/* ------------------------------------------------------------- milestones */

@Injectable()
export class MilestonesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'milestone', ['title'], ['dueOn', 'position', 'createdAt'], 'Milestone');
  }

  protected override buildFilters(query: Record<string, any>) {
    return query.projectId ? { projectId: query.projectId } : {};
  }

  createMilestone(dto: CreateMilestoneDto) {
    return this.create({
      ...orgScope(),
      ...dto,
      cost: new Prisma.Decimal(dto.cost ?? 0),
      dueOn: dto.dueOn ? new Date(dto.dueOn) : null,
    });
  }

  updateMilestone(id: string, dto: UpdateMilestoneDto) {
    return this.update(id, {
      ...dto,
      ...(dto.cost != null ? { cost: new Prisma.Decimal(dto.cost) } : {}),
      ...(dto.dueOn ? { dueOn: new Date(dto.dueOn) } : {}),
    });
  }
}

/* ------------------------------------------------------------------ tasks */

@Injectable()
export class TasksService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService, private readonly cache: CacheService) {
    super(prisma, 'task', ['title', 'code', 'description'], ['dueOn', 'priority', 'status', 'createdAt'], 'Task');
  }

  protected override buildFilters(query: TaskQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.milestoneId) where.milestoneId = query.milestoneId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.assigneeId) where.assignees = { some: { userId: query.assigneeId } };
    if (query.overdue === 'true') {
      where.dueOn = { lt: new Date() };
      where.status = { not: 'COMPLETED' };
    }
    return where;
  }

  protected override listInclude() {
    return {
      project: { select: { id: true, code: true, name: true } },
      assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    };
  }

  async createTask(dto: CreateTaskDto) {
    const ctx = getTenantContext();
    const code = dto.code ?? (await this.nextCode(dto.projectId));

    const created = await this.prisma.transaction(async (tx) =>
      tx.task.create({
        data: {
          ...orgScope(),
          code,
          title: dto.title,
          description: dto.description ?? null,
          projectId: dto.projectId ?? null,
          milestoneId: dto.milestoneId ?? null,
          status: dto.status ?? 'TODO',
          priority: dto.priority ?? 'MEDIUM',
          dueOn: dto.dueOn ? new Date(dto.dueOn) : null,
          estimatedHours: new Prisma.Decimal(dto.estimatedHours ?? 0),
          sourceType: dto.sourceType ?? 'MANUAL',
          sourceRef: dto.sourceRef ?? null,
          createdById: ctx?.userId ?? null,
          assignees: dto.assigneeIds?.length
            ? { create: dto.assigneeIds.map((userId) => ({ userId })) }
            : undefined,
        },
        include: this.listInclude() as never,
      }),
    );

    await this.audit('CREATE', created.id, `${created.code} ${created.title}`, undefined, created);
    return created;
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    const before = await this.findOne(id);

    const updated = await this.prisma.transaction(async (tx) => {
      if (dto.assigneeIds) {
        await tx.taskAssignee.deleteMany({ where: { taskId: id } });
        if (dto.assigneeIds.length) {
          await tx.taskAssignee.createMany({
            data: dto.assigneeIds.map((userId) => ({ taskId: id, userId })),
            skipDuplicates: true,
          });
        }
      }
      return tx.task.update({
        where: { id },
        data: {
          ...(dto.title ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
          ...(dto.milestoneId !== undefined ? { milestoneId: dto.milestoneId } : {}),
          ...(dto.priority ? { priority: dto.priority } : {}),
          ...(dto.dueOn !== undefined ? { dueOn: dto.dueOn ? new Date(dto.dueOn) : null } : {}),
          ...(dto.estimatedHours != null
            ? { estimatedHours: new Prisma.Decimal(dto.estimatedHours) }
            : {}),
          // completedAt is derived from status, never set directly.
          ...(dto.status
            ? {
                status: dto.status,
                completedAt: dto.status === 'COMPLETED' ? new Date() : null,
              }
            : {}),
        },
        include: this.listInclude() as never,
      });
    });

    await this.audit('UPDATE', id, `${(updated as any).code} ${(updated as any).title}`, before, updated);
    await this.recomputeProjectProgress((updated as any).projectId);
    return updated;
  }

  /** Board move — the only field a drag changes. */
  async moveStatus(id: string, status: 'INCOMPLETE' | 'TODO' | 'DOING' | 'COMPLETED') {
    return this.updateTask(id, { status } as UpdateTaskDto);
  }

  /**
   * Project progress is the share of its tasks that are complete. Kept as a
   * stored column because every list and portal reads it, and recomputed here
   * so it cannot drift from the tasks it summarises.
   */
  private async recomputeProjectProgress(projectId: string | null): Promise<void> {
    if (!projectId) return;
    const [total, done] = await Promise.all([
      this.prisma.db.task.count({ where: { projectId } }),
      this.prisma.db.task.count({ where: { projectId, status: 'COMPLETED' } }),
    ]);
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    await this.prisma.db.project.update({ where: { id: projectId }, data: { progress } });
  }

  private async nextCode(projectId?: string): Promise<string> {
    if (projectId) {
      const project = await this.prisma.db.project.findFirst({
        where: { id: projectId },
        select: { code: true, _count: { select: { tasks: true } } },
      });
      if (project) return `${project.code}-${project._count.tasks + 1}`;
    }
    const count = await this.prisma.db.task.count();
    return `TSK-${count + 1}`;
  }
}

/* -------------------------------------------------------------- time logs */

@Injectable()
export class TimeLogsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'timeLog', ['note'], ['startedAt', 'hours', 'createdAt'], 'Time log');
  }

  protected override buildFilters(query: TimeLogQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.taskId) where.taskId = query.taskId;
    if (query.from || query.to) {
      where.startedAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    return where;
  }

  protected override listInclude() {
    return {
      employee: { select: { id: true, name: true } },
      task: { select: { id: true, code: true, title: true } },
      project: { select: { id: true, code: true, name: true } },
    };
  }

  async createTimeLog(dto: CreateTimeLogDto) {
    const startedAt = new Date(dto.startedAt);
    const endedAt = dto.endedAt ? new Date(dto.endedAt) : null;

    if (endedAt && endedAt <= startedAt) {
      throw new BusinessRuleError('INVALID_RANGE', 'The end time must be after the start time');
    }

    // Hours are stored, not derived, so editing a log later keeps its billed
    // value rather than silently re-deriving from shifted timestamps.
    const hours =
      dto.hours ?? (endedAt ? (endedAt.getTime() - startedAt.getTime()) / 3_600_000 : 0);

    if (hours > 24) {
      throw new BusinessRuleError('IMPLAUSIBLE_DURATION', 'A single entry cannot exceed 24 hours');
    }

    // Derive the project from the task when it wasn't given.
    let projectId = dto.projectId ?? null;
    if (!projectId && dto.taskId) {
      const task = await this.prisma.db.task.findFirst({
        where: { id: dto.taskId },
        select: { projectId: true },
      });
      projectId = task?.projectId ?? null;
    }

    return this.create({
      ...orgScope(),
      employeeId: dto.employeeId,
      taskId: dto.taskId ?? null,
      projectId,
      startedAt,
      endedAt,
      hours: new Prisma.Decimal(round2(hours)),
      note: dto.note ?? null,
      billable: dto.billable ?? true,
    });
  }

  /** Timesheet totals per employee for a period. */
  async timesheet(from: string, to: string, employeeId?: string) {
    const logs = await this.prisma.db.timeLog.findMany({
      where: {
        startedAt: { gte: new Date(from), lte: new Date(to) },
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: { select: { id: true, name: true, hourlyRate: true } },
        project: { select: { id: true, code: true, name: true } },
      },
      orderBy: { startedAt: 'asc' },
    });

    const byEmployee = new Map<string, { name: string; hours: number; value: number }>();
    for (const log of logs) {
      const entry = byEmployee.get(log.employeeId) ?? {
        name: log.employee.name,
        hours: 0,
        value: 0,
      };
      entry.hours += Number(log.hours);
      entry.value += Number(log.hours) * Number(log.employee.hourlyRate);
      byEmployee.set(log.employeeId, entry);
    }

    return {
      period: { from, to },
      totalHours: round2(logs.reduce((a, l) => a + Number(l.hours), 0)),
      byEmployee: [...byEmployee.entries()].map(([id, v]) => ({
        employeeId: id,
        name: v.name,
        hours: round2(v.hours),
        value: round2(v.value),
      })),
      entries: logs,
    };
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
