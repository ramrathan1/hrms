import { Injectable } from '@nestjs/common';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/domain.error';
import { currentUserId, holdsAny } from '../../common/self-scope';
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

  /* Working the queue is what tickets:update means. Without it, a ticket you
     did not raise is somebody else's correspondence — on the list, and on a
     read by id, which is what the detail route does. */
  protected override scopeFilter() {
    return holdsAny('tickets:update') ? {} : { createdById: currentUserId() };
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

  /**
   * The ticket with a readable conversation.
   *
   * Replies carry an author id and nothing else, so every message would reach
   * the screen unsigned — which is how the detail page ended up inventing names
   * for them. The names are resolved here. Internal notes are stripped for the
   * person who raised the ticket: they are notes *about* their request.
   */
  override async findOne(id: string) {
    const ticket = (await super.findOne(id)) as Row & {
      replies?: { authorId: string | null; isInternal: boolean }[];
    };
    const replies = ticket.replies ?? [];
    const agent = holdsAny('tickets:update');

    const authorIds = [...new Set(replies.map((r) => r.authorId).filter(Boolean))] as string[];
    const authors = authorIds.length
      ? await this.prisma.db.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(authors.map((u) => [u.id, u.name]));

    return {
      ...ticket,
      replies: replies
        .filter((r) => agent || !r.isInternal)
        .map((r) => ({ ...r, authorName: r.authorId ? nameOf.get(r.authorId) ?? null : null })),
    };
  }

  async createTicket(dto: CreateTicketDto) {
    const number = await this.nextNumber();
    const ctx = getTenantContext();

    // The author is recorded rather than inferred from the requester name: this
    // is what lets the person who raised a ticket follow up on it later. The
    // name is filled in too, so no ticket reaches a screen unattributed.
    let requesterName = dto.requesterName;
    if (!requesterName && ctx?.userId) {
      const me = await this.prisma.db.user.findFirst({
        where: { id: ctx.userId },
        select: { name: true },
      });
      requesterName = me?.name;
    }

    return this.create({
      ...orgScope(),
      ...dto,
      requesterName: requesterName ?? null,
      number,
      createdById: ctx?.userId ?? null,
    });
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

    /* Two people may write here: an agent working the queue, and the person who
       raised it. Anyone else is reading someone else's correspondence. */
    const agent = holdsAny('tickets:update');
    if (!agent && ticket.createdById !== currentUserId()) {
      throw new ForbiddenError(
        'You can only reply to tickets you raised.',
        'NOT_YOUR_TICKET',
      );
    }

    const ctx = getTenantContext();
    return this.prisma.transaction(async (tx) => {
      const reply = await tx.ticketReply.create({
        data: {
          ...orgScope(),
          ticketId,
          authorId: ctx?.userId ?? null,
          body: dto.body,
          // An internal note is the team talking among themselves about the
          // request; the requester cannot write one.
          isInternal: agent ? dto.isInternal ?? false : false,
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
