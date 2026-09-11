import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { Prisma, PrismaClient } from '../../generated/prisma/client';
import {
  getTenantContext,
  isUnscoped,
  type TenantContext,
} from '../tenant/tenant-context';
import {
  CREATE_OPERATIONS,
  GLOBAL_MODELS,
  isOrgScoped,
  isUserScoped,
  MUTATE_MANY_OPERATIONS,
  ORG_SCOPED_MODELS,
  READ_OPERATIONS,
  SINGLE_MUTATE_OPERATIONS,
} from './tenant-models';

/**
 * Prisma client with tenant isolation enforced in the query layer.
 *
 * Controllers and services never write `where: { organizationId }` themselves.
 * Forgetting it would be a cross-tenant data leak, and "remember to add the
 * filter" is not a security control — so the filter is injected here, below
 * every caller, for every model in ORG_SCOPED_MODELS.
 *
 * Connection is a `pg` Pool handed to Prisma through @prisma/adapter-pg, which
 * is how Prisma 7 takes a driver.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;
  private readonly base: PrismaClient;

  /** Tenant-guarded client. Everything in the app uses this. */
  readonly db: ReturnType<PrismaService['withTenantGuard']>;

  constructor(private readonly config: ConfigService) {
    const url = this.config.getOrThrow<string>('database.url');

    this.pool = new Pool({
      connectionString: url,
      max: this.config.get<number>('database.poolMax', 10),
      idleTimeoutMillis: this.config.get<number>('database.idleTimeoutMs', 30_000),
      // Fail fast rather than hanging a request behind an exhausted pool.
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: false,
    });

    this.pool.on('error', (err) => {
      this.logger.error(`Idle Postgres client error: ${err.message}`, err.stack);
    });

    this.base = new PrismaClient({
      adapter: new PrismaPg(this.pool),
      log: this.config.get('nodeEnv') === 'development' ? ['warn', 'error'] : ['error'],
    });

    this.db = this.withTenantGuard();
  }

  async onModuleInit(): Promise<void> {
    this.assertEveryTenantModelIsClassified();

    try {
      await this.base.$connect();
      this.logger.log('Postgres connected');
    } catch (err) {
      // Boot anyway: Swagger and health should still serve so the failure is
      // diagnosable from the outside instead of a silent crash loop.
      this.logger.error(
        `Postgres unavailable at startup — the API is up but data routes will fail. ${(err as Error).message}`,
      );
    }
  }

  /**
   * Refuse to boot with an unguarded tenant model.
   *
   * The scope lists are written by hand on purpose, but a hand-written list
   * silently rots: add a model with an `organizationId` and forget the list,
   * and every query against it returns every tenant's rows. The generated
   * client knows which models carry the column, so compare the two here — at
   * startup, loudly — rather than discovering it from a customer.
   */
  private assertEveryTenantModelIsClassified(): void {
    const scalarEnums = Object.entries(Prisma as unknown as Record<string, unknown>).filter(
      ([name]) => name.endsWith('ScalarFieldEnum'),
    );

    const unclassified = scalarEnums
      .filter(([, fields]) => fields && typeof fields === 'object' && 'organizationId' in fields)
      .map(([name]) => name.replace(/ScalarFieldEnum$/, ''))
      .filter((model) => !ORG_SCOPED_MODELS.has(model) && !GLOBAL_MODELS.has(model));

    if (unclassified.length) {
      throw new Error(
        `These models carry an organizationId but are not listed in ORG_SCOPED_MODELS: ` +
          `${unclassified.join(', ')}. Add them to src/infra/prisma/tenant-models.ts — ` +
          `until you do, queries against them are not tenant-filtered.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.base.$disconnect().catch(() => undefined);
    await this.pool.end().catch(() => undefined);
  }

  /** Raw, unguarded client. Only for migrations, health and seeds. */
  get unsafe(): PrismaClient {
    return this.base;
  }

  async ping(): Promise<boolean> {
    const res = await this.base.$queryRaw<[{ ok: number }]>`SELECT 1 as ok`;
    return res?.[0]?.ok === 1;
  }

  /**
   * Run a set of writes atomically, with the tenant guard still in force.
   *
   * The transaction is opened on the *extended* client, not the base one. A
   * transaction client has no `$extends` of its own, so wrapping it afterwards
   * throws — but a transaction started from an extended client inherits the
   * extension, which is what keeps every write inside the block tenant-scoped.
   *
   * The context itself flows through because AsyncLocalStorage survives awaits.
   */
  transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return (this.db as unknown as PrismaClient).$transaction((tx) =>
      fn(tx as unknown as PrismaClient),
    ) as Promise<T>;
  }

  /* ------------------------------------------------------------ the guard */

  private withTenantGuard() {
    return this.guard(this.base);
  }

  private guard<T extends PrismaClient>(client: T) {
    const logger = this.logger;

    return client.$extends({
      name: 'tenant-isolation',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const orgScoped = isOrgScoped(model);
            if (!orgScoped) return query(args);

            const ctx = getTenantContext();

            // No context on a tenant-scoped model means someone is querying
            // outside a request without declaring intent. Refuse rather than
            // return every tenant's rows.
            if (!ctx) {
              throw new InternalServerErrorException(
                `Query on tenant-scoped model "${model}" ran without a tenant context. ` +
                  `Wrap background work in runWithTenantContext() or runUnscoped().`,
              );
            }

            if (isUnscoped(ctx)) return query(args);

            const scope = buildScope(model, ctx);
            const next = args as Record<string, any>;

            if (READ_OPERATIONS.has(operation) || MUTATE_MANY_OPERATIONS.has(operation)) {
              // findUnique cannot take arbitrary filters; promote it so the
              // tenant predicate is still applied.
              if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
                const promoted = operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
                return (client as any)[lowerFirst(model!)][promoted]({
                  ...next,
                  where: { ...(next.where ?? {}), ...scope },
                });
              }
              next.where = { ...(next.where ?? {}), ...scope };
              return query(next as typeof args);
            }

            if (CREATE_OPERATIONS.has(operation)) {
              if (Array.isArray(next.data)) {
                next.data = next.data.map((row: Record<string, unknown>) => ({ ...row, ...scope }));
              } else {
                next.data = { ...(next.data ?? {}), ...scope };
              }
              return query(next as typeof args);
            }

            if (SINGLE_MUTATE_OPERATIONS.has(operation)) {
              // update/delete address a unique row; re-check tenancy first so a
              // guessed id from another tenant cannot be written.
              const uniqueWhere = next.where ?? {};
              const found = await (client as any)[lowerFirst(model!)].findFirst({
                where: { ...uniqueWhere, ...scope },
                select: { id: true },
              });
              if (!found) {
                logger.warn(
                  `Blocked cross-tenant ${operation} on ${model} by user ${ctx.userId}`,
                );
                // Same shape as "not found" — never confirm the row exists
                // in another tenant.
                throw new PrismaTenantNotFound(model!);
              }
              if (operation === 'upsert') {
                next.create = { ...(next.create ?? {}), ...scope };
              }
              return query(next as typeof args);
            }

            return query(args);
          },
        },
      },
    });
  }
}

/** Raised when a row exists but belongs to another tenant. Mapped to 404. */
export class PrismaTenantNotFound extends Error {
  constructor(readonly model: string) {
    super(`${model} not found`);
    this.name = 'PrismaTenantNotFound';
  }
}

function buildScope(model: string | undefined, ctx: TenantContext): Record<string, string> {
  const scope: Record<string, string> = { organizationId: ctx.organizationId };
  // USER-scoped models narrow further: private to the person, inside the tenant.
  if (isUserScoped(model)) scope.userId = ctx.userId;
  return scope;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
