import { Logger } from '@nestjs/common';

import type { PrismaService } from '../../infra/prisma/prisma.service';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';
import { NotFoundError } from '../errors/domain.error';
import { paginate, type Paginated, type PaginationQueryDto } from '../dto/pagination.dto';

/**
 * A date with no time, as every date input in the app produces it.
 *
 * Prisma accepts full ISO-8601 timestamps but rejects "2026-09-01", so a form
 * that sends a plain date reaches the driver as an unusable string. Nothing
 * else in a payload looks like this, which is what makes the check safe to
 * apply everywhere rather than field by field.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Convert any date-only string in a write payload into a real Date. */
function withDates(data: Record<string, unknown>): Record<string, unknown> {
  let touched = false;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && DATE_ONLY.test(value)) {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isNaN(parsed.getTime())) {
        out[key] = parsed;
        touched = true;
        continue;
      }
    }
    out[key] = value;
  }
  return touched ? out : data;
}

/**
 * Shared list/read/write behaviour for domain services.
 *
 * This exists so pagination, sorting, search and audit are implemented once
 * and behave identically across 30-odd modules — not to hide Prisma. Services
 * extend it and then write real domain methods; anything with business rules
 * (invoice payment, leave approval) overrides rather than inherits.
 *
 * Tenancy is NOT handled here: it is enforced beneath this layer by the Prisma
 * extension, so a service that bypasses this base class is still safe.
 */
export abstract class BaseCrudService<TModel extends { id: string }> {
  protected readonly logger: Logger;

  protected constructor(
    protected readonly prisma: PrismaService,
    /** Prisma model accessor name, e.g. "client". */
    protected readonly modelName: string,
    /** Fields free-text search scans. */
    protected readonly searchableFields: string[] = [],
    /** Fields a caller may sort by — an allow-list, not arbitrary input. */
    protected readonly sortableFields: string[] = ['createdAt', 'updatedAt'],
    /** Human name used in error messages. */
    protected readonly entityLabel = modelName,
  ) {
    this.logger = new Logger(`${modelName}Service`);
  }

  protected get model(): any {
    return (this.prisma.db as any)[this.modelName];
  }

  /** Extra filters merged into every list query. Override per module. */
  protected buildFilters(_query: PaginationQueryDto): Record<string, unknown> {
    return {};
  }

  /**
   * Which rows this caller may reach at all — not a filter they asked for.
   *
   * Separate from `buildFilters` because it applies to reads by id as well as
   * to lists. Scoping only the list leaves the detail route open: the ids are
   * in plain sight on every screen, and `update`/`remove` read through
   * `findOne` too, so an unscoped read is also an unscoped write.
   *
   * Override per module; see common/self-scope.ts for the shared rule.
   */
  protected scopeFilter(): Record<string, unknown> {
    return {};
  }

  /** Relations to include on list. Override per module. */
  protected listInclude(): Record<string, unknown> | undefined {
    return undefined;
  }

  /** Relations to include on a single read. Override per module. */
  protected detailInclude(): Record<string, unknown> | undefined {
    return this.listInclude();
  }

  async findAll(query: PaginationQueryDto): Promise<Paginated<TModel>> {
    /* Kept as separate AND clauses rather than merged into one object: a
       module filter and a search both want `OR`, and spreading them together
       silently drops one of them. */
    const clauses = [this.scopeFilter(), this.buildFilters(query)];
    if (query.q && this.searchableFields.length) {
      clauses.push({
        OR: this.searchableFields.map((field) => ({
          [field]: { contains: query.q, mode: 'insensitive' },
        })),
      });
    }
    const used = clauses.filter((clause) => Object.keys(clause).length > 0);
    const where: Record<string, unknown> =
      used.length === 0 ? {} : used.length === 1 ? used[0] : { AND: used };

    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

    // One round trip for the page, one for the count. Both go through the
    // tenant guard, so both are scoped.
    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.limit,
        include: this.listInclude(),
      }),
      this.model.count({ where }),
    ]);

    return paginate<TModel>(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<TModel> {
    const scope = this.scopeFilter();
    const found = await this.model.findFirst({
      // A record you may not see reads as one that is not there, which is also
      // what stops the 404/403 difference from confirming it exists.
      where: Object.keys(scope).length ? { AND: [{ id }, scope] } : { id },
      include: this.detailInclude(),
    });
    if (!found) throw new NotFoundError(this.entityLabel, id);
    return found;
  }

  async create(data: Record<string, unknown>): Promise<TModel> {
    const created = await this.model.create({
      data: withDates(data),
      include: this.detailInclude(),
    });
    await this.audit('CREATE', created.id, this.describe(created), undefined, created);
    return created;
  }

  async update(id: string, data: Record<string, unknown>): Promise<TModel> {
    const before = await this.findOne(id);
    const updated = await this.model.update({
      where: { id },
      data: withDates(data),
      include: this.detailInclude(),
    });
    await this.audit('UPDATE', id, this.describe(updated), before, updated);
    return updated;
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const before = await this.findOne(id);
    await this.model.delete({ where: { id } });
    await this.audit('DELETE', id, this.describe(before), before, undefined);
    return { id, deleted: true };
  }

  /* ------------------------------------------------------------ internals */

  private buildOrderBy(
    sortBy: string | undefined,
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Record<string, string> {
    // Unvalidated sort fields become an injection surface and a source of
    // 500s on typos, so only allow-listed columns are honoured.
    const field =
      sortBy && this.sortableFields.includes(sortBy) ? sortBy : this.sortableFields[0];
    return { [field]: sortOrder };
  }

  /** Short label for the audit trail — overridden where a better one exists. */
  protected describe(row: Record<string, any>): string {
    return String(
      row?.name ?? row?.title ?? row?.number ?? row?.subject ?? row?.code ?? row?.id ?? '',
    );
  }

  protected async audit(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'PAYMENT' | 'EXPORT',
    entityId: string,
    summary: string,
    before?: unknown,
    after?: unknown,
  ): Promise<void> {
    const ctx = getTenantContext();
    if (!ctx?.userId) return;
    try {
      await this.prisma.db.auditLog.create({
        data: {
          ...orgScope(),
          actorId: ctx.userId,
          action,
          entity: this.entityLabel,
          entityId,
          summary,
          before: before ? (JSON.parse(JSON.stringify(before)) as object) : undefined,
          after: after ? (JSON.parse(JSON.stringify(after)) as object) : undefined,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      });
    } catch (err) {
      // A failed audit write must never fail the operation it describes, but
      // it must be visible.
      this.logger.error(`Audit write failed for ${this.entityLabel}/${entityId}`, err as Error);
    }
  }
}
