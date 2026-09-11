import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { orgScope, requireTenantContext } from '../../infra/tenant/tenant-context';
import type {
  CreateLeadEmailDto, CreateLeadFormDto, CreateProposalDto, LeadEmailQueryDto,
  ProposalQueryDto, UpdateLeadFormDto, UpdateProposalDto,
} from './dto/sales.dto';

type Row = { id: string };

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);

/**
 * Capture forms. The submission count is derived from the leads a form
 * produced, so it cannot drift out of step with the leads themselves.
 */
@Injectable()
export class LeadFormsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'leadForm', ['name', 'slug'], ['name', 'createdAt'], 'Lead form');
  }

  protected override listInclude() {
    return { _count: { select: { submissions: true } } };
  }

  async createForm(dto: CreateLeadFormDto) {
    const slug = dto.slug?.trim() || slugify(dto.name);
    const clash = await this.prisma.db.leadForm.findFirst({ where: { slug }, select: { id: true } });
    if (clash) throw new ConflictError('SLUG_TAKEN', `A form already uses "${slug}"`);

    return this.create({
      ...orgScope(),
      name: dto.name,
      slug,
      fields: (dto.fields ?? []) as Prisma.InputJsonValue,
      active: dto.active ?? true,
    });
  }

  updateForm(id: string, dto: UpdateLeadFormDto) {
    return this.update(id, {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.slug ? { slug: slugify(dto.slug) } : {}),
      ...(dto.fields ? { fields: dto.fields as Prisma.InputJsonValue } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });
  }
}

/** Mail sent to a lead before they become a client. */
@Injectable()
export class LeadEmailsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'leadEmail', ['subject', 'toEmail'], ['sentAt'], 'Lead email');
  }

  protected override buildFilters(query: LeadEmailQueryDto) {
    return query.leadId ? { leadId: query.leadId } : {};
  }

  protected override listInclude() {
    return { lead: { select: { id: true, name: true, company: true } } };
  }

  async log(dto: CreateLeadEmailDto) {
    const ctx = requireTenantContext();
    const lead = await this.prisma.db.lead.findFirst({
      where: { id: dto.leadId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundError('Lead', dto.leadId);

    return this.create({
      ...orgScope(),
      leadId: dto.leadId,
      subject: dto.subject,
      body: dto.body ?? null,
      toEmail: dto.toEmail.toLowerCase(),
      sentById: ctx.userId,
    });
  }
}

/**
 * Proposals — priced offers sent to a lead, before an invoice exists.
 *
 * Numbering is server-side for the same reason invoice numbers are: two people
 * drafting at once must not both be handed PROP#004.
 */
@Injectable()
export class ProposalsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'proposal', ['number', 'title'], ['issuedOn', 'total', 'createdAt'], 'Proposal');
  }

  protected override buildFilters(query: ProposalQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.leadId) where.leadId = query.leadId;
    return where;
  }

  protected override listInclude() {
    return { lead: { select: { id: true, name: true, company: true } } };
  }

  async createProposal(dto: CreateProposalDto) {
    return this.prisma.transaction(async (tx) => {
      const number = dto.number?.trim() || `PROP#${String((await tx.proposal.count()) + 1).padStart(4, '0')}`;

      const clash = await tx.proposal.findFirst({ where: { number }, select: { id: true } });
      if (clash) throw new ConflictError('NUMBER_TAKEN', `Proposal ${number} already exists`);

      const created = await tx.proposal.create({
        data: {
          ...orgScope(),
          leadId: dto.leadId ?? null,
          number,
          title: dto.title ?? null,
          total: new Prisma.Decimal(dto.total),
          currency: dto.currency ?? 'USD',
          issuedOn: new Date(dto.issuedOn ?? Date.now()),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          status: dto.status ?? 'Draft',
          note: dto.note ?? null,
        },
        include: this.listInclude() as never,
      });
      await this.audit('CREATE', created.id, number);
      return created;
    });
  }

  updateProposal(id: string, dto: UpdateProposalDto) {
    return this.update(id, {
      ...(dto.leadId !== undefined ? { leadId: dto.leadId ?? null } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.total !== undefined ? { total: new Prisma.Decimal(dto.total) } : {}),
      ...(dto.issuedOn ? { issuedOn: new Date(dto.issuedOn) } : {}),
      ...(dto.validUntil ? { validUntil: new Date(dto.validUntil) } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
    });
  }

  /**
   * Turn an accepted proposal into an estimate the client can be billed from.
   * The proposal is marked converted so the same offer can't be raised twice.
   */
  async convertToEstimate(id: string) {
    return this.prisma.transaction(async (tx) => {
      const proposal = await tx.proposal.findFirst({
        where: { id },
        include: { lead: { select: { convertedClientId: true } } },
      });
      if (!proposal) throw new NotFoundError('Proposal', id);
      if (proposal.status === 'Converted') {
        throw new ConflictError('ALREADY_CONVERTED', 'This proposal is already an estimate');
      }

      const number = `EST#${String((await tx.estimate.count()) + 1).padStart(4, '0')}`;
      const estimate = await tx.estimate.create({
        data: {
          ...orgScope(),
          // A proposal goes to a lead; carry the client across only once that
          // lead has actually been converted.
          clientId: proposal.lead?.convertedClientId ?? null,
          number,
          issuedOn: new Date(),
          validUntil: proposal.validUntil,
          currency: proposal.currency,
          total: proposal.total,
          status: 'Draft',
        },
      });

      await tx.proposal.update({ where: { id }, data: { status: 'Converted' } });
      await this.audit('UPDATE', id, `${proposal.number} → ${number}`);
      return { proposal: { ...proposal, status: 'Converted' }, estimate };
    });
  }
}
