import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CacheService } from '../../infra/cache/cache.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';

import type {
  ConvertLeadDto, CreateDealDto, CreateLeadDto, CreateLeadNoteDto, CreateStageDto,
  DealQueryDto, LeadQueryDto, MoveDealDto, UpdateDealDto, UpdateLeadDto,
  LeadNoteQueryDto,
} from './dto/crm.dto';

type Row = { id: string };

/* ------------------------------------------------------------------ leads */

@Injectable()
export class LeadsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'lead', ['name', 'company', 'email', 'phone'], ['name', 'createdAt'], 'Lead');
  }

  protected override buildFilters(query: LeadQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.ownerId) where.ownerId = query.ownerId;
    return where;
  }

  protected override detailInclude() {
    return {
      notes: { orderBy: { createdAt: 'desc' as const } },
      deals: { include: { stage: true } },
    };
  }

  createLead(dto: CreateLeadDto) {
    return this.create({
      ...orgScope(),
      ...dto,
      value: dto.value != null ? new Prisma.Decimal(dto.value) : null,
    });
  }

  updateLead(id: string, dto: UpdateLeadDto) {
    return this.update(id, {
      ...dto,
      ...(dto.value != null ? { value: new Prisma.Decimal(dto.value) } : {}),
    });
  }

  async addNote(leadId: string, dto: CreateLeadNoteDto) {
    await this.findOne(leadId);
    const ctx = getTenantContext();
    return this.prisma.db.leadNote.create({
      data: { ...orgScope(), leadId, body: dto.body, authorId: ctx?.userId ?? null },
    });
  }

  /**
   * Convert a lead into a client.
   *
   * One transaction covering three writes: create the client, optionally spin
   * up a project from the won deal, and mark the lead converted with a pointer
   * to the client so the CRM history survives. A partial write here would leave
   * a lead that looks converted with no client behind it.
   */
  async convert(leadId: string, dto: ConvertLeadDto) {
    const result = await this.prisma.transaction(async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id: leadId }, include: { deals: true } });
      if (!lead) throw new NotFoundError('Lead', leadId);
      if (lead.status === 'CONVERTED') {
        throw new ConflictError(
          'LEAD_ALREADY_CONVERTED',
          'This lead has already been converted to a client',
        );
      }

      const client = await tx.client.create({
        data: {
          ...orgScope(),
          name: dto.contactName ?? lead.name,
          company: dto.company ?? lead.company ?? lead.name,
          email: dto.email ?? lead.email ?? null,
          phone: lead.phone ?? null,
          status: 'ACTIVE',
          convertedFromLeadId: lead.id,
        },
      });

      let project: { id: string; code: string; name: string } | null = null;
      if (dto.createProject) {
        const wonValue = lead.deals.reduce((a, d) => a + Number(d.value), 0);
        const created = await tx.project.create({
          data: {
            ...orgScope(),
            clientId: client.id,
            code: dto.projectCode ?? (await nextProjectCode(tx)),
            name: dto.projectName ?? `${client.company} engagement`,
            status: 'NOT_STARTED',
            startsOn: new Date(),
            budget: new Prisma.Decimal(dto.projectBudget ?? wonValue),
          },
          select: { id: true, code: true, name: true },
        });
        project = created;
      }

      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data: { status: 'CONVERTED', convertedAt: new Date(), convertedClientId: client.id },
      });

      return { lead: updatedLead, client, project };
    });

    await this.audit(
      'UPDATE',
      leadId,
      `Converted to client ${result.client.company}` + (result.project ? ' with a project' : ''),
      undefined,
      result,
    );
    return result;
  }
}

/* ------------------------------------------------------------------ deals */

@Injectable()
export class DealsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService, private readonly cache: CacheService) {
    super(prisma, 'deal', ['title'], ['value', 'expectedCloseOn', 'createdAt'], 'Deal');
  }

  protected override buildFilters(query: DealQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.stageId) where.stageId = query.stageId;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.leadId) where.leadId = query.leadId;
    if (query.open === 'true') where.closedAt = null;
    return where;
  }

  protected override listInclude() {
    return {
      stage: { select: { id: true, name: true, position: true, outcome: true } },
      lead: { select: { id: true, name: true, company: true } },
    };
  }

  createDeal(dto: CreateDealDto) {
    return this.create({
      ...orgScope(),
      ...dto,
      value: new Prisma.Decimal(dto.value ?? 0),
      expectedCloseOn: dto.expectedCloseOn ? new Date(dto.expectedCloseOn) : null,
    });
  }

  updateDeal(id: string, dto: UpdateDealDto) {
    return this.update(id, {
      ...dto,
      ...(dto.value != null ? { value: new Prisma.Decimal(dto.value) } : {}),
      ...(dto.expectedCloseOn ? { expectedCloseOn: new Date(dto.expectedCloseOn) } : {}),
    });
  }

  /**
   * Move a deal to another pipeline stage. Landing on a terminal stage stamps
   * `closedAt`, which is what makes "open pipeline" a reliable query rather
   * than a guess based on stage names.
   */
  async moveToStage(dealId: string, dto: MoveDealDto) {
    const result = await this.prisma.transaction(async (tx) => {
      const deal = await tx.deal.findFirst({ where: { id: dealId } });
      if (!deal) throw new NotFoundError('Deal', dealId);

      const stage = await tx.pipelineStage.findFirst({ where: { id: dto.stageId } });
      if (!stage) throw new NotFoundError('Pipeline stage', dto.stageId);

      const terminal = stage.outcome !== 'OPEN';
      return tx.deal.update({
        where: { id: dealId },
        data: {
          stageId: stage.id,
          closedAt: terminal ? (deal.closedAt ?? new Date()) : null,
          ...(terminal && stage.outcome === 'WON' ? { probability: 100 } : {}),
          ...(terminal && stage.outcome === 'LOST' ? { probability: 0 } : {}),
        },
        include: { stage: true },
      });
    });

    await this.cache.del('crm:pipeline');
    await this.audit('UPDATE', dealId, `Moved to ${result.stage.name}`);
    return result;
  }

  /** Pipeline board: stages with their deals and totals. */
  async pipeline() {
    return this.cache.wrap('crm:pipeline', 30, async () => {
      const stages = await this.prisma.db.pipelineStage.findMany({
        orderBy: { position: 'asc' },
        include: {
          deals: {
            where: { closedAt: null },
            include: { lead: { select: { id: true, name: true, company: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return stages.map((s) => ({
        id: s.id,
        name: s.name,
        position: s.position,
        outcome: s.outcome,
        dealCount: s.deals.length,
        value: round2(s.deals.reduce((a, d) => a + Number(d.value), 0)),
        deals: s.deals.map((d) => ({
          id: d.id,
          title: d.title,
          value: Number(d.value),
          probability: d.probability,
          expectedCloseOn: d.expectedCloseOn,
          lead: d.lead,
        })),
      }));
    });
  }
}

/* ------------------------------------------------------------- stages */

@Injectable()
export class PipelineStagesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'pipelineStage', ['name'], ['position', 'name'], 'Pipeline stage');
  }

  createStage(dto: CreateStageDto) {
    return this.create({ ...orgScope(), ...dto });
  }

  /** Refuse to delete a stage that still holds deals — they'd be orphaned. */
  override async remove(id: string) {
    const count = await this.prisma.db.deal.count({ where: { stageId: id } });
    if (count > 0) {
      throw new ConflictError(
        'STAGE_IN_USE',
        `${count} deal(s) are still in this stage. Move them first.`,
      );
    }
    return super.remove(id);
  }
}

/* ---------------------------------------------------------------- helpers */

async function nextProjectCode(tx: { project: { findFirst: Function } }): Promise<string> {
  const last = await tx.project.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { code: true },
  });
  const digits = Number(String(last?.code ?? '').replace(/\D/g, '')) || 0;
  return `PRJ${String(digits + 1).padStart(3, '0')}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A flat view of lead notes, for screens that show activity across leads. */
@Injectable()
export class LeadNotesService extends BaseCrudService<{ id: string }> {
  constructor(prisma: PrismaService) {
    super(prisma, 'leadNote', ['body'], ['createdAt'], 'Lead note');
  }

  protected override buildFilters(query: LeadNoteQueryDto) {
    return query.leadId ? { leadId: query.leadId } : {};
  }

  protected override listInclude() {
    return { lead: { select: { id: true, name: true, company: true } } };
  }
}
