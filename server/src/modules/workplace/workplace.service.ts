import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain.error';
import { orgScope } from '../../infra/tenant/tenant-context';
import type {
  AssignAssetDto, CreateAssetDto, CreateEventDto, CreateKbArticleDto, CreateNoticeDto,
  CreateTemplateDto, GenerateLetterDto, PreviewLetterDto,
} from './dto/workplace.dto';

type Row = { id: string };

/* ----------------------------------------------------------------- assets */

@Injectable()
export class AssetsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'asset', ['name', 'assetCode', 'serialNumber'], ['name', 'createdAt'], 'Asset');
  }

  protected override buildFilters(query: Record<string, any>) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.category) where.category = query.category;
    return where;
  }

  createAsset(dto: CreateAssetDto) {
    return this.create({
      ...orgScope(),
      ...dto,
      cost: dto.cost != null ? new Prisma.Decimal(dto.cost) : null,
      purchasedOn: dto.purchasedOn ? new Date(dto.purchasedOn) : null,
    });
  }

  /**
   * Hand an asset to someone, or take it back.
   *
   * Every hand-over writes an AssetMovement. The frontend wrote these and never
   * read them back, so an asset's history was lost; here the trail is the point
   * of the operation.
   */
  async assign(assetId: string, dto: AssignAssetDto) {
    return this.prisma.transaction(async (tx) => {
      const asset = await tx.asset.findFirst({ where: { id: assetId } });
      if (!asset) throw new NotFoundError('Asset', assetId);

      if (asset.status === 'RETIRED') {
        throw new BusinessRuleError('ASSET_RETIRED', 'A retired asset cannot be assigned');
      }

      await tx.assetMovement.create({
        data: {
          assetId,
          fromUserId: asset.assignedToId,
          toUserId: dto.toUserId ?? null,
          note: dto.note ?? null,
        },
      });

      return tx.asset.update({
        where: { id: assetId },
        data: {
          assignedToId: dto.toUserId ?? null,
          status: dto.toUserId ? 'ASSIGNED' : 'AVAILABLE',
        },
      });
    });
  }

  history(assetId: string) {
    return this.prisma.db.assetMovement.findMany({
      where: { assetId },
      orderBy: { movedAt: 'desc' },
    });
  }
}

/* ----------------------------------------------------- events & notices */

@Injectable()
export class EventsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'event', ['title', 'description', 'location'], ['startsAt', 'createdAt'], 'Event');
  }

  protected override buildFilters(query: Record<string, any>) {
    const where: Record<string, unknown> = {};
    if (query.upcoming === 'true') where.startsAt = { gte: new Date() };
    if (query.from || query.to) {
      where.startsAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    return where;
  }

  createEvent(dto: CreateEventDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (endsAt && endsAt < startsAt) {
      throw new BusinessRuleError('INVALID_RANGE', 'The event cannot end before it starts');
    }
    return this.create({ ...orgScope(), ...dto, startsAt, endsAt });
  }
}

@Injectable()
export class NoticesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'notice', ['title', 'body'], ['publishedAt', 'createdAt'], 'Notice');
  }

  protected override buildFilters(query: Record<string, any>) {
    // A draft notice has no publishedAt, so "published" is a real filter
    // rather than a status column that can drift.
    return query.published === 'true' ? { publishedAt: { not: null } } : {};
  }

  createNotice(dto: CreateNoticeDto) {
    return this.create({
      ...orgScope(),
      ...dto,
      publishedAt: dto.publish ? new Date() : null,
      publish: undefined,
    });
  }

  publish(id: string) {
    return this.update(id, { publishedAt: new Date() });
  }
}

@Injectable()
export class KbService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'kbArticle', ['title', 'body', 'category'], ['title', 'createdAt'], 'Article');
  }

  protected override buildFilters(query: Record<string, any>) {
    const where: Record<string, unknown> = {};
    if (query.category) where.category = query.category;
    if (query.visibility) where.visibility = query.visibility;
    return where;
  }

  createArticle(dto: CreateKbArticleDto) {
    return this.create({ ...orgScope(), ...dto });
  }
}

/* ---------------------------------------------------------------- letters */

/** The merge tokens a template may use. */
const MERGE_FIELDS = [
  'employee_name', 'designation', 'department', 'joining_date',
  'salary', 'email', 'manager', 'company', 'today',
] as const;

@Injectable()
export class LettersService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'letterTemplate', ['name', 'body'], ['name', 'updatedAt'], 'Letter template');
  }

  createTemplate(dto: CreateTemplateDto) {
    return this.create({ ...orgScope(), ...dto });
  }

  /** The tokens a client can offer, so the UI never has to hardcode them. */
  mergeFields() {
    return MERGE_FIELDS.map((token) => ({ token, placeholder: `{{${token}}}` }));
  }

  /**
   * Render a template against an employee without saving.
   *
   * Unrecognised tokens are deliberately left visible rather than blanked, so a
   * typo in a template surfaces in the preview instead of vanishing from the
   * finished letter.
   */
  async preview(dto: PreviewLetterDto) {
    const body = dto.body ?? (await this.templateBody(dto.templateId));
    const values = await this.resolveValues(dto.employeeId);

    const merged = body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, token: string) => {
      const value = values[token.toLowerCase()];
      return value ?? whole;
    });

    const unresolved = [...new Set(merged.match(/\{\{\s*[a-z_]+\s*\}\}/gi) ?? [])];
    return { body: merged, unresolved };
  }

  /**
   * Issue a letter. The merged body is stored as a snapshot — editing the
   * template later must not rewrite a letter that has already gone out.
   */
  async generate(dto: GenerateLetterDto) {
    const { body } = await this.preview({
      templateId: dto.templateId,
      employeeId: dto.employeeId,
      body: dto.body,
    });

    const letter = await this.prisma.db.generatedLetter.create({
      data: {
        ...orgScope(),
        templateId: dto.templateId ?? null,
        employeeId: dto.employeeId,
        body: dto.body ?? body,
        issuedOn: new Date(),
      },
    });

    await this.audit('CREATE', letter.id, 'Letter issued', undefined, letter);
    return letter;
  }

  /** Withdraw an issued letter. */
  async removeGenerated(id: string) {
    const letter = await this.prisma.db.generatedLetter.findFirst({ where: { id } });
    if (!letter) throw new NotFoundError('Letter', id);

    await this.prisma.db.generatedLetter.delete({ where: { id } });
    await this.audit('DELETE', id, 'Letter withdrawn', letter, undefined);
    return { id, deleted: true as const };
  }

  listGenerated(employeeId?: string) {
    return this.prisma.db.generatedLetter.findMany({
      where: employeeId ? { employeeId } : {},
      orderBy: { issuedOn: 'desc' },
      include: { template: { select: { id: true, name: true } } },
    });
  }

  private async templateBody(templateId?: string): Promise<string> {
    if (!templateId) {
      throw new BusinessRuleError('NO_TEMPLATE', 'Provide a templateId or a body to merge');
    }
    const template = await this.prisma.db.letterTemplate.findFirst({ where: { id: templateId } });
    if (!template) throw new NotFoundError('Letter template', templateId);
    return template.body;
  }

  private async resolveValues(employeeId: string): Promise<Record<string, string>> {
    const employee = await this.prisma.db.employee.findFirst({
      where: { id: employeeId },
      include: {
        department: { select: { name: true } },
        designation: { select: { name: true } },
        reportsTo: { select: { name: true } },
        organization: { select: { name: true } },
        salaries: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
      },
    });
    if (!employee) throw new NotFoundError('Employee', employeeId);

    const salary = employee.salaries[0];
    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: salary?.currency ?? 'USD' });

    return {
      employee_name: employee.name,
      designation: employee.designation?.name ?? '—',
      department: employee.department?.name ?? '—',
      joining_date: employee.joinedOn.toISOString().slice(0, 10),
      salary: salary ? fmt.format(Number(salary.annualAmount)) : '—',
      email: employee.email,
      manager: employee.reportsTo?.name ?? '—',
      company: employee.organization.name,
      today: new Date().toISOString().slice(0, 10),
    };
  }
}
