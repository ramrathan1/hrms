import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ConflictError, NotFoundError, BusinessRuleError } from '../../common/errors/domain.error';
import { orgScope, requireTenantContext, userScope } from '../../infra/tenant/tenant-context';
import { paginate, type PaginationQueryDto } from '../../common/dto/pagination.dto';
import type {
  CreateTodoDto, CreateUserDto, NotificationQueryDto, NotifyDto, UpdateTodoDto,
  UpdateUserDto, UserQueryDto,
} from './dto/workspace.dto';

const BCRYPT_ROUNDS = 10;

/** Login accounts. Distinct from Employee, which is the HR record. */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly SELECT = {
    id: true, email: true, name: true, avatarUrl: true, status: true,
    lastLoginAt: true, createdAt: true,
    roles: { select: { role: { select: { id: true, key: true, name: true } } } },
    employee: { select: { id: true, employeeCode: true } },
  } as const;

  async findAll(query: UserQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.role) where.roles = { some: { role: { key: query.role } } };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.db.user.findMany({
        where,
        select: UsersService.SELECT,
        orderBy: { name: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.db.user.count({ where }),
    ]);

    return paginate(rows.map(flattenRoles), total, query.page, query.limit);
  }

  async findOne(id: string) {
    const user = await this.prisma.db.user.findFirst({
      where: { id },
      select: UsersService.SELECT,
    });
    if (!user) throw new NotFoundError('User', id);
    return flattenRoles(user);
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const clash = await this.prisma.db.user.findFirst({ where: { email }, select: { id: true } });
    if (clash) throw new ConflictError('EMAIL_TAKEN', 'Someone here already uses that email');

    const roleIds = await this.resolveRoles(dto.roles ?? ['EMPLOYEE']);
    const user = await this.prisma.db.user.create({
      data: {
        ...orgScope(),
        email,
        name: dto.name,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        status: 'INVITED',
        roles: { create: roleIds.map((roleId) => ({ roleId })) },
      },
      select: UsersService.SELECT,
    });
    return flattenRoles(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const ctx = requireTenantContext();
    const existing = await this.prisma.db.user.findFirst({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('User', id);

    // Locking yourself out is the one mistake an admin cannot undo from the UI.
    if (id === ctx.userId && dto.status && dto.status !== 'ACTIVE') {
      throw new BusinessRuleError('SELF_SUSPEND', 'You cannot suspend your own account');
    }

    const data: Record<string, unknown> = {};
    if (dto.name) data.name = dto.name;
    if (dto.email) data.email = dto.email.toLowerCase();
    if (dto.status) data.status = dto.status;
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      // A password change ends every session that used the old one.
      data.tokensValidFrom = new Date();
    }

    if (dto.roles) {
      const roleIds = await this.resolveRoles(dto.roles);
      await this.prisma.db.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.db.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
      });
      // Permissions are read from the token, so the old one must stop working.
      data.tokensValidFrom = new Date();
    }

    const user = await this.prisma.db.user.update({
      where: { id },
      data,
      select: UsersService.SELECT,
    });
    return flattenRoles(user);
  }

  /**
   * Suspend rather than delete. A user is referenced by audit logs, tasks and
   * messages; removing the row would either cascade that history away or fail.
   */
  async deactivate(id: string) {
    const ctx = requireTenantContext();
    if (id === ctx.userId) {
      throw new BusinessRuleError('SELF_SUSPEND', 'You cannot deactivate your own account');
    }
    const user = await this.prisma.db.user.update({
      where: { id },
      data: { status: 'SUSPENDED', tokensValidFrom: new Date() },
      select: UsersService.SELECT,
    });
    await this.prisma.db.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return flattenRoles(user);
  }

  private async resolveRoles(keys: string[]): Promise<string[]> {
    const roles = await this.prisma.db.role.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    });
    const missing = keys.filter((k) => !roles.some((r) => r.key === k));
    if (missing.length) {
      throw new BusinessRuleError('UNKNOWN_ROLE', `Unknown role(s): ${missing.join(', ')}`);
    }
    return roles.map((r) => r.id);
  }
}

function flattenRoles<T extends { roles?: Array<{ role: { key: string; name: string } }> }>(user: T) {
  return { ...user, roles: (user.roles ?? []).map((r) => r.role) };
}

/* -------------------------------------------------------- notifications */

/**
 * Notifications are user-scoped: the Prisma extension pins every read and
 * write to the signed-in user, so one person can never read another's bell.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async findAll(query: NotificationQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.unreadOnly === true || query.unreadOnly === 'true') where.readAt = null;

    const [rows, total, unread] = await Promise.all([
      this.prisma.db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.db.notification.count({ where }),
      this.prisma.db.notification.count({ where: { readAt: null } }),
    ]);

    return { ...paginate(rows, total, query.page, query.limit), unread };
  }

  async markRead(id: string) {
    const found = await this.prisma.db.notification.findFirst({ where: { id } });
    if (!found) throw new NotFoundError('Notification', id);
    if (found.readAt) return found;
    return this.prisma.db.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead() {
    const { count } = await this.prisma.db.notification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
    return { marked: count };
  }

  async remove(id: string) {
    await this.markRead(id); // reuse the ownership check
    await this.prisma.db.notification.delete({ where: { id } });
    return { id, deleted: true as const };
  }

  /**
   * Store, then push. Persisting first means a notification raised while the
   * recipient is offline still shows up when they next open the app; the socket
   * push is only the live delivery on top of it.
   */
  async notify(dto: NotifyDto) {
    const ctx = requireTenantContext();
    const row = await this.prisma.db.notification.create({
      data: {
        ...orgScope(),
        userId: dto.userId,
        title: dto.title,
        body: dto.body ?? null,
        kind: dto.kind ?? 'info',
        linkTo: dto.linkTo ?? null,
      },
    });
    await this.realtime.notifyUser(ctx.organizationId, dto.userId, row).catch(() => undefined);
    return row;
  }
}

/* ----------------------------------------------------------------- todos */

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: PaginationQueryDto) {
    return this.prisma.db.todo.findMany({
      orderBy: [{ done: 'asc' }, { dueOn: 'asc' }, { createdAt: 'desc' }],
      take: query.limit,
      skip: query.skip,
    });
  }

  create(dto: CreateTodoDto) {
    return this.prisma.db.todo.create({
      data: {
        ...orgScope(),
        ...userScope(),
        title: dto.title,
        dueOn: dto.dueOn ? new Date(dto.dueOn) : null,
      },
    });
  }

  async update(id: string, dto: UpdateTodoDto) {
    const found = await this.prisma.db.todo.findFirst({ where: { id } });
    if (!found) throw new NotFoundError('Todo', id);
    return this.prisma.db.todo.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.done !== undefined ? { done: dto.done } : {}),
        ...(dto.dueOn !== undefined ? { dueOn: dto.dueOn ? new Date(dto.dueOn) : null } : {}),
      },
    });
  }

  async remove(id: string) {
    const found = await this.prisma.db.todo.findFirst({ where: { id } });
    if (!found) throw new NotFoundError('Todo', id);
    await this.prisma.db.todo.delete({ where: { id } });
    return { id, deleted: true as const };
  }
}
