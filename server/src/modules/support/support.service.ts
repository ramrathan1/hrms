import { Injectable } from '@nestjs/common';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';
import type {
  CreateReplyDto, CreateTicketDto, TicketQueryDto, UpdateTicketDto,
} from './dto/support.dto';

type Row = { id: string };

@Injectable()
export class TicketsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'ticket', ['subject', 'body', 'number', 'requesterName'],
      ['createdAt', 'priority', 'status'], 'Ticket');
  }

  protected override buildFilters(query: TicketQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.clientId) where.clientId = query.clientId;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.open === 'true') where.status = { in: ['OPEN', 'PENDING'] };
    return where;
  }

  protected override listInclude() {
    return {
      client: { select: { id: true, name: true, company: true } },
      _count: { select: { replies: true } },
    };
  }

  protected override detailInclude() {
    return {
      client: { select: { id: true, name: true, company: true, email: true } },
      replies: { orderBy: { createdAt: 'asc' as const } },
    };
  }

  async createTicket(dto: CreateTicketDto) {
    const number = await this.nextNumber();
    return this.create({ ...orgScope(), ...dto, number });
  }

  async updateTicket(id: string, dto: UpdateTicketDto) {
    // closedAt follows from status rather than being set by the caller.
    const closing = dto.status === 'RESOLVED' || dto.status === 'CLOSED';
    return this.update(id, {
      ...dto,
      ...(dto.status ? { closedAt: closing ? new Date() : null } : {}),
    });
  }

  /**
   * Add a reply. Internal notes are excluded from the client portal, so the
   * flag is part of the record rather than a UI concern.
   */
  async reply(ticketId: string, dto: CreateReplyDto) {
    const ticket = await this.prisma.db.ticket.findFirst({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundError('Ticket', ticketId);
    if (ticket.status === 'CLOSED') {
      throw new ConflictError('TICKET_CLOSED', 'Reopen this ticket before replying');
    }

    const ctx = getTenantContext();
    return this.prisma.transaction(async (tx) => {
      const reply = await tx.ticketReply.create({
        data: {
          ...orgScope(),
          ticketId,
          authorId: ctx?.userId ?? null,
          body: dto.body,
          isInternal: dto.isInternal ?? false,
        },
      });
      // A public reply on a resolved ticket puts it back in play.
      if (!reply.isInternal && ticket.status === 'RESOLVED') {
        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: 'OPEN', closedAt: null },
        });
      }
      return reply;
    });
  }

  /** Counts by status, for the support dashboard. */
  async stats() {
    const grouped = await this.prisma.db.ticket.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
    return {
      open: counts.OPEN ?? 0,
      pending: counts.PENDING ?? 0,
      resolved: counts.RESOLVED ?? 0,
      closed: counts.CLOSED ?? 0,
      total: Object.values(counts).reduce<number>((a, n) => a + (n as number), 0),
    };
  }

  private async nextNumber(): Promise<string> {
    const count = await this.prisma.db.ticket.count();
    return `TKT#${String(count + 1).padStart(4, '0')}`;
  }
}
