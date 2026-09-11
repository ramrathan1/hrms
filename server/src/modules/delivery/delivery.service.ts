import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { orgScope, requireTenantContext } from '../../infra/tenant/tenant-context';
import type {
  ContractQueryDto, CreateContractDto, CreateDiscussionDto, CreateIdeaDto,
  DiscussionQueryDto, IdeaQueryDto, ReplyDto, UpdateContractDto,
  UpdateDiscussionDto, UpdateIdeaDto,
} from './dto/delivery.dto';

type Row = { id: string };

@Injectable()
export class ContractsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'contract', ['number', 'title'], ['startsOn', 'value', 'createdAt'], 'Contract');
  }

  protected override buildFilters(query: ContractQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.clientId) where.clientId = query.clientId;
    if (query.status) where.status = query.status;
    return where;
  }

  protected override listInclude() {
    return {
      client: { select: { id: true, name: true, company: true } },
      project: { select: { id: true, name: true, code: true } },
    };
  }

  async createContract(dto: CreateContractDto) {
    return this.prisma.transaction(async (tx) => {
      const number =
        dto.number?.trim() || `CONTRACT#${String((await tx.contract.count()) + 1).padStart(4, '0')}`;
      const clash = await tx.contract.findFirst({ where: { number }, select: { id: true } });
      if (clash) throw new ConflictError('NUMBER_TAKEN', `Contract ${number} already exists`);

      const created = await tx.contract.create({
        data: {
          ...orgScope(),
          number,
          title: dto.title,
          kind: dto.kind ?? null,
          clientId: dto.clientId ?? null,
          projectId: dto.projectId ?? null,
          value: new Prisma.Decimal(dto.value ?? 0),
          startsOn: dto.startsOn ? new Date(dto.startsOn) : null,
          endsOn: dto.endsOn ? new Date(dto.endsOn) : null,
          status: dto.status ?? 'Draft',
        },
        include: this.listInclude() as never,
      });
      await this.audit('CREATE', created.id, number);
      return created;
    });
  }

  updateContract(id: string, dto: UpdateContractDto) {
    return this.update(id, {
      ...(dto.title ? { title: dto.title } : {}),
      ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
      ...(dto.clientId !== undefined ? { clientId: dto.clientId ?? null } : {}),
      ...(dto.projectId !== undefined ? { projectId: dto.projectId ?? null } : {}),
      ...(dto.value !== undefined ? { value: new Prisma.Decimal(dto.value) } : {}),
      ...(dto.startsOn ? { startsOn: new Date(dto.startsOn) } : {}),
      ...(dto.endsOn ? { endsOn: new Date(dto.endsOn) } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    });
  }

  /** Signing is a one-way door — it stamps when, not just that. */
  async sign(id: string) {
    const contract = await this.prisma.db.contract.findFirst({ where: { id } });
    if (!contract) throw new NotFoundError('Contract', id);
    if (contract.signedAt) throw new ConflictError('ALREADY_SIGNED', 'This contract is signed');

    const updated = await this.prisma.db.contract.update({
      where: { id },
      data: { signedAt: new Date(), status: 'Signed' },
      include: this.listInclude() as never,
    });
    await this.audit('APPROVE', id, `${contract.number} signed`);
    return updated;
  }
}

@Injectable()
export class DiscussionsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'discussion', ['title', 'body'], ['createdAt'], 'Discussion');
  }

  protected override buildFilters(query: DiscussionQueryDto) {
    return query.projectId ? { projectId: query.projectId } : {};
  }

  protected override listInclude() {
    return {
      project: { select: { id: true, name: true } },
      _count: { select: { replies: true } },
    };
  }

  protected override detailInclude() {
    return {
      project: { select: { id: true, name: true } },
      replies: { orderBy: { createdAt: 'asc' as const } },
    };
  }

  async start(dto: CreateDiscussionDto) {
    const ctx = requireTenantContext();
    const project = await this.prisma.db.project.findFirst({
      where: { id: dto.projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundError('Project', dto.projectId);

    return this.create({
      ...orgScope(),
      projectId: dto.projectId,
      title: dto.title,
      body: dto.body,
      authorId: ctx.userId,
    });
  }

  updateDiscussion(id: string, dto: UpdateDiscussionDto) {
    return this.update(id, {
      ...(dto.title ? { title: dto.title } : {}),
      ...(dto.body ? { body: dto.body } : {}),
    });
  }

  async reply(id: string, dto: ReplyDto) {
    const ctx = requireTenantContext();
    const discussion = await this.prisma.db.discussion.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!discussion) throw new NotFoundError('Discussion', id);

    return this.prisma.db.discussionReply.create({
      data: { ...orgScope(), discussionId: id, authorId: ctx.userId, body: dto.body },
    });
  }
}

/**
 * The public roadmap.
 *
 * Votes are rows, not a counter: a counter can be clicked twice by the same
 * person and can never be un-clicked correctly.
 */
@Injectable()
export class RoadmapService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'roadmapIdea', ['title', 'detail', 'category'], ['createdAt', 'title'], 'Idea');
  }

  protected override buildFilters(query: IdeaQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    return where;
  }

  protected override listInclude() {
    return { _count: { select: { votes: true } } };
  }

  /** Ideas with the vote count and whether *you* voted, newest support first. */
  override async findAll(query: IdeaQueryDto) {
    const ctx = requireTenantContext();
    const page = await super.findAll(query);
    const ids = (page.data as Array<{ id: string }>).map((i) => i.id);

    const mine = ids.length
      ? await this.prisma.db.roadmapIdeaVote.findMany({
          where: { ideaId: { in: ids }, userId: ctx.userId },
          select: { ideaId: true },
        })
      : [];
    const voted = new Set(mine.map((v) => v.ideaId));

    const data = (page.data as unknown as Array<Record<string, unknown>>).map((idea) => ({
      ...idea,
      votes: (idea._count as { votes?: number } | undefined)?.votes ?? 0,
      votedByMe: voted.has(String(idea.id)),
    }));

    return { ...page, data: data as unknown as typeof page.data };
  }

  createIdea(dto: CreateIdeaDto) {
    const ctx = requireTenantContext();
    return this.create({
      ...orgScope(),
      title: dto.title,
      detail: dto.detail ?? null,
      category: dto.category ?? null,
      status: dto.status ?? 'Under Review',
      createdById: ctx.userId,
    });
  }

  updateIdea(id: string, dto: UpdateIdeaDto) {
    return this.update(id, {
      ...(dto.title ? { title: dto.title } : {}),
      ...(dto.detail !== undefined ? { detail: dto.detail } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    });
  }

  /** Vote, or take it back. Idempotent in both directions. */
  async toggleVote(id: string) {
    const ctx = requireTenantContext();
    const idea = await this.prisma.db.roadmapIdea.findFirst({ where: { id }, select: { id: true } });
    if (!idea) throw new NotFoundError('Idea', id);

    const existing = await this.prisma.db.roadmapIdeaVote.findFirst({
      where: { ideaId: id, userId: ctx.userId },
    });

    if (existing) {
      await this.prisma.db.roadmapIdeaVote.delete({
        where: { ideaId_userId: { ideaId: id, userId: ctx.userId } },
      });
    } else {
      await this.prisma.db.roadmapIdeaVote.create({ data: { ideaId: id, userId: ctx.userId } });
    }

    const votes = await this.prisma.db.roadmapIdeaVote.count({ where: { ideaId: id } });
    return { id, votes, votedByMe: !existing };
  }
}
