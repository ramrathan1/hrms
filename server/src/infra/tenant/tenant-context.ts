import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request-scoped identity, carried without threading it through every call.
 *
 * This is the tenant boundary. It is set once, by TenantMiddleware, from the
 * verified JWT — never from a header, query parameter or request body, because
 * any of those would let a caller choose their own tenant.
 */
export interface TenantContext {
  organizationId: string;
  userId: string;
  /** Role keys, for RolesGuard. */
  roles: string[];
  /** Flattened permission keys, for PermissionsGuard. */
  permissions: string[];
  requestId: string;
  ip?: string;
  userAgent?: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

/** The current context, or undefined outside a request (jobs, boot, CLI). */
export const getTenantContext = (): TenantContext | undefined =>
  tenantContextStorage.getStore();

/**
 * The current context, or throw. Used by anything that must not silently run
 * unscoped — a missing context here is a bug, not an anonymous request.
 */
export function requireTenantContext(): TenantContext {
  const ctx = tenantContextStorage.getStore();
  if (!ctx) {
    throw new Error(
      'Tenant context is missing. Code that touches tenant data must run inside ' +
        'tenantContextStorage.run() — see runWithTenantContext() for jobs and seeds.',
    );
  }
  return ctx;
}

export const currentOrganizationId = (): string | undefined =>
  tenantContextStorage.getStore()?.organizationId;

export const currentUserId = (): string | undefined =>
  tenantContextStorage.getStore()?.userId;

/**
 * Run work inside an explicit context. Background jobs and the seed script use
 * this, since they have no HTTP request to derive one from.
 */
export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return tenantContextStorage.run(ctx, fn);
}

/**
 * Escape hatch for the few genuinely cross-tenant operations — resolving a
 * login before the tenant is known, platform health checks, migrations.
 * Deliberately verbose: an unscoped query should be visible in review.
 */
export const SYSTEM_CONTEXT_ORG = '__system__';

export function runUnscoped<T>(fn: () => T): T {
  return tenantContextStorage.run(
    {
      organizationId: SYSTEM_CONTEXT_ORG,
      userId: SYSTEM_CONTEXT_ORG,
      roles: [],
      permissions: [],
      requestId: 'system',
    },
    fn,
  );
}

export const isUnscoped = (ctx?: TenantContext): boolean =>
  ctx?.organizationId === SYSTEM_CONTEXT_ORG;

/**
 * The tenant columns, for a Prisma `create`.
 *
 * The Prisma extension stamps these anyway, so this is not what enforces
 * tenancy — it exists because the generated types require a NOT NULL
 * organizationId at compile time. Passing it here and having the extension
 * overwrite it means a caller who supplies the *wrong* organization is
 * silently corrected rather than trusted.
 */
export function orgScope(): { organizationId: string } {
  return { organizationId: requireTenantContext().organizationId };
}

/** Both tenant columns, for USER-scoped models. */
export function userScope(): { organizationId: string; userId: string } {
  const ctx = requireTenantContext();
  return { organizationId: ctx.organizationId, userId: ctx.userId };
}
