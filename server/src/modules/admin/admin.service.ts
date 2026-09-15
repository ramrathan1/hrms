import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { currentUserId, holdsAny, peopleScope } from '../../common/self-scope';
import { CacheService } from '../../infra/cache/cache.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';
import { paginate, type PaginationQueryDto } from '../../common/dto/pagination.dto';
import { SYSTEM_PERMISSIONS } from '../rbac/rbac.constants';
import type { AuditQueryDto, SaveSettingDto, SetRolePermissionsDto } from './dto/admin.dto';

/* ------------------------------------------------------------- settings */

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAll() {
    return this.prisma.db.setting.findMany({ orderBy: { key: 'asc' } });
  }

  async findOne(key: string) {
    const row = await this.prisma.db.setting.findFirst({ where: { key } });
    // A pane that has never been saved is empty, not missing.
    return row ?? { key, value: {}, updatedAt: null };
  }

  /**
   * Merge rather than replace.
   *
   * Settings panes are tabbed, and each shows a slice of the same key. A
   * replacing write would silently wipe the fields the open tab isn't showing.
   */
  async save(key: string, dto: SaveSettingDto) {
    const existing = await this.prisma.db.setting.findFirst({ where: { key } });
    const merged = {
      ...((existing?.value as object) ?? {}),
      ...dto.value,
    } as Prisma.InputJsonObject;

    const row = existing
      ? await this.prisma.db.setting.update({ where: { id: existing.id }, data: { value: merged } })
      : await this.prisma.db.setting.create({ data: { ...orgScope(), key, value: merged } });

    await this.cache.del(`settings:${key}`);
    return row;
  }
}

/* ----------------------------------------------------------------- RBAC */

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAll() {
    return this.prisma.db.role.findMany({
      orderBy: { key: 'asc' },
      include: {
        permissions: { include: { permission: { select: { key: true, module: true, action: true } } } },
        _count: { select: { users: true } },
      },
    });
  }

  /** The whole catalogue, grouped by module — what the matrix UI renders. */
  async catalogue() {
    const permissions = await this.prisma.db.permission.findMany({ orderBy: { key: 'asc' } });
    const byModule = new Map<string, { key: string; action: string; description: string | null }[]>();
    for (const p of permissions) {
      const list = byModule.get(p.module) ?? [];
      list.push({ key: p.key, action: p.action, description: p.description });
      byModule.set(p.module, list);
    }
    return {
      total: permissions.length,
      modules: [...byModule.entries()].map(([module, actions]) => ({ module, actions })),
    };
  }

  /**
   * Replace a role's permissions.
   *
   * Any write implies read — granting `create` without `view` produces a role
   * that can add records it cannot see, which is never what the operator meant.
   * The invariant is enforced here rather than trusted from the client.
   */
  async setPermissions(roleId: string, dto: SetRolePermissionsDto) {
    const role = await this.prisma.db.role.findFirst({ where: { id: roleId } });
    if (!role) throw new NotFoundError('Role', roleId);

    const requested = new Set(dto.permissionKeys);
    for (const key of dto.permissionKeys) {
      const [module, action] = key.split(':');
      if (['create', 'update', 'delete'].includes(action)) requested.add(`${module}:read`);
    }

    const known = new Set(SYSTEM_PERMISSIONS.map((p) => p.key));
    const unknown = [...requested].filter((k) => !known.has(k));
    if (unknown.length) {
      throw new ConflictError('UNKNOWN_PERMISSION', `Not a known permission: ${unknown.join(', ')}`);
    }

    const permissions = await this.prisma.db.permission.findMany({
      where: { key: { in: [...requested] } },
      select: { id: true },
    });

    await this.prisma.transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionId: p.id })),
        skipDuplicates: true,
      });
      // Force everyone holding this role to pick up the change on their next
      // refresh rather than waiting out their current access token.
      await tx.user.updateMany({
        where: { roles: { some: { roleId } } },
        data: { tokensValidFrom: new Date() },
      });
    });

    await this.cache.del(`roles:${roleId}`);
    return { roleId, granted: requested.size };
  }
}

/* ---------------------------------------------------------------- audit */

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AuditQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.entity) where.entity = query.entity;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = query.action;
    if (query.q) {
      // Free text across the human-readable parts of the entry.
      where.OR = [
        { summary: { contains: query.q, mode: 'insensitive' } },
        { entity: { contains: query.q, mode: 'insensitive' } },
        { entityId: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.db.auditLog.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }
}

/* -------------------------------------------------------------- reports */

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * The cross-module figures every dashboard and portal reads.
   *
   * Computed in one place so the numbers agree wherever they appear — the
   * frontend derived these inline in several components with slightly different
   * expressions, and they drifted.
   */
  async summary() {
    return this.cache.wrap('reports:summary', 60, async () => {
      const now = new Date();

      const [
        invoiceAgg, overdueInvoices, expenseAgg, pendingExpenses,
        projects, activeProjects, taskAgg, openTasks, overdueTasks,
        employees, pendingLeave, clients, leads, openDeals, openTickets, timeAgg,
      ] = await Promise.all([
        this.prisma.db.invoice.aggregate({
          _sum: { total: true, paidAmount: true }, _count: true,
          where: { status: { not: 'CANCELLED' } },
        }),
        this.prisma.db.invoice.count({
          where: { dueOn: { lt: now }, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
        }),
        this.prisma.db.expense.aggregate({
          _sum: { amount: true }, where: { status: { not: 'REJECTED' } },
        }),
        this.prisma.db.expense.count({ where: { status: 'PENDING' } }),
        this.prisma.db.project.count(),
        this.prisma.db.project.count({ where: { status: 'IN_PROGRESS' } }),
        this.prisma.db.task.count(),
        this.prisma.db.task.count({ where: { status: { not: 'COMPLETED' } } }),
        this.prisma.db.task.count({ where: { dueOn: { lt: now }, status: { not: 'COMPLETED' } } }),
        this.prisma.db.employee.count({ where: { status: 'ACTIVE' } }),
        this.prisma.db.leaveRequest.count({ where: { status: 'PENDING' } }),
        this.prisma.db.client.count({ where: { status: 'ACTIVE' } }),
        this.prisma.db.lead.count(),
        this.prisma.db.deal.count({ where: { closedAt: null } }),
        this.prisma.db.ticket.count({ where: { status: { in: ['OPEN', 'PENDING'] } } }),
        this.prisma.db.timeLog.aggregate({ _sum: { hours: true } }),
      ]);

      const billed = Number(invoiceAgg._sum.total ?? 0);
      const collected = Number(invoiceAgg._sum.paidAmount ?? 0);
      const spend = Number(expenseAgg._sum.amount ?? 0);

      return {
        finance: {
          billed: round2(billed),
          collected: round2(collected),
          outstanding: round2(billed - collected),
          collectionRate: billed > 0 ? Number(((collected / billed) * 100).toFixed(1)) : 0,
          expenses: round2(spend),
          margin: round2(collected - spend),
          invoices: invoiceAgg._count,
          overdueInvoices,
          pendingExpenses,
        },
        work: {
          projects,
          activeProjects,
          tasks: taskAgg,
          openTasks,
          overdueTasks,
          hoursLogged: round2(Number(timeAgg._sum.hours ?? 0)),
        },
        people: { employees, pendingLeave },
        sales: { clients, leads, openDeals },
        support: { openTickets },
      };
    });
  }

  /** Everything waiting on the current user — the Approvals inbox. */
  async approvals() {
    const [leave, expenses] = await Promise.all([
      this.prisma.db.leaveRequest.findMany({
        where: { status: 'PENDING' },
        include: {
          employee: { select: { id: true, name: true } },
          leaveType: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.db.expense.findMany({
        where: { status: 'PENDING' },
        include: { employee: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      total: leave.length + expenses.length,
      leave,
      expenses,
    };
  }

  /** Figures for whichever portal the caller lands on. */
  async myWork() {
    const ctx = getTenantContext()!;
    const employee = await this.prisma.db.employee.findFirst({
      where: { userId: ctx.userId },
      select: { id: true },
    });

    const [assigned, overdue, hours, leave] = await Promise.all([
      this.prisma.db.task.count({
        where: { assignees: { some: { userId: ctx.userId } }, status: { not: 'COMPLETED' } },
      }),
      this.prisma.db.task.count({
        where: {
          assignees: { some: { userId: ctx.userId } },
          status: { not: 'COMPLETED' },
          dueOn: { lt: new Date() },
        },
      }),
      employee
        ? this.prisma.db.timeLog.aggregate({ _sum: { hours: true }, where: { employeeId: employee.id } })
        : Promise.resolve({ _sum: { hours: null } }),
      employee
        ? this.prisma.db.leaveRequest.count({ where: { employeeId: employee.id, status: 'PENDING' } })
        : Promise.resolve(0),
    ]);

    return {
      employeeId: employee?.id ?? null,
      openTasks: assigned,
      overdueTasks: overdue,
      hoursLogged: round2(Number(hours._sum.hours ?? 0)),
      pendingLeave: leave,
    };
  }

  /** Cross-entity search, replacing the frontend's client-side scan. */
  async search(q: string, limit = 5) {
    const term = q.trim();
    if (!term) return [];

    const like = { contains: term, mode: 'insensitive' as const };
    const none = Promise.resolve([] as never[]);

    /* Search used to run every branch for everyone, so it answered questions
       the screens themselves refuse: an employee typing a name found invoices,
       leads and colleagues' tickets. Each branch now asks the same two
       questions the list endpoints ask — may you read this module, and whose
       records may you see. */
    const mine = peopleScope() !== 'all';
    const userId = currentUserId();

    const [employees, clients, projects, tasks, invoices, leads, tickets] = await Promise.all([
      holdsAny('employees:read')
        ? this.prisma.db.employee.findMany({ where: { name: like }, take: limit, select: { id: true, name: true, employeeCode: true } })
        : none,
      holdsAny('clients:read')
        ? this.prisma.db.client.findMany({ where: { OR: [{ name: like }, { company: like }] }, take: limit, select: { id: true, name: true, company: true } })
        : none,
      holdsAny('projects:read')
        ? this.prisma.db.project.findMany({
            where: {
              OR: [{ name: like }, { code: like }],
              ...(mine ? { members: { some: { userId } } } : {}),
            },
            take: limit,
            select: { id: true, name: true, code: true },
          })
        : none,
      holdsAny('tasks:read')
        ? this.prisma.db.task.findMany({
            where: {
              OR: [{ title: like }, { code: like }],
              ...(mine
                ? {
                    AND: [{
                      OR: [
                        { assignees: { some: { userId } } },
                        { createdById: userId },
                        { project: { members: { some: { userId } } } },
                      ],
                    }],
                  }
                : {}),
            },
            take: limit,
            select: { id: true, title: true, code: true },
          })
        : none,
      holdsAny('invoices:read')
        ? this.prisma.db.invoice.findMany({ where: { number: like }, take: limit, select: { id: true, number: true, status: true } })
        : none,
      holdsAny('leads:read')
        ? this.prisma.db.lead.findMany({ where: { OR: [{ name: like }, { company: like }] }, take: limit, select: { id: true, name: true, company: true } })
        : none,
      holdsAny('tickets:read')
        ? this.prisma.db.ticket.findMany({
            where: {
              OR: [{ subject: like }, { number: like }],
              ...(holdsAny('tickets:update') ? {} : { createdById: userId }),
            },
            take: limit,
            select: { id: true, subject: true, number: true },
          })
        : none,
    ]);

    return [
      ...employees.map((e) => ({ type: 'Employee', id: e.id, label: e.name, sub: e.employeeCode, to: `/hr/employees/${e.id}` })),
      ...clients.map((c) => ({ type: 'Client', id: c.id, label: c.name, sub: c.company, to: `/clients/${c.id}` })),
      ...projects.map((p) => ({ type: 'Project', id: p.id, label: p.name, sub: p.code, to: `/work/projects/${p.id}` })),
      ...tasks.map((t) => ({ type: 'Task', id: t.id, label: t.title, sub: t.code, to: '/work/tasks' })),
      ...invoices.map((i) => ({ type: 'Invoice', id: i.id, label: i.number, sub: i.status, to: `/finance/invoices/${i.id}` })),
      ...leads.map((l) => ({ type: 'Lead', id: l.id, label: l.name, sub: l.company ?? '', to: '/leads' })),
      ...tickets.map((t) => ({ type: 'Ticket', id: t.id, label: t.subject, sub: t.number, to: `/tickets/${t.id}` })),
    ];
  }

}

const round2 = (n: number) => Math.round(n * 100) / 100;
