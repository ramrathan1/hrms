import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ForbiddenError } from '../errors/domain.error';
import { getTenantContext } from '../../infra/tenant/tenant-context';

/**
 * Granular gate. Every listed permission must be held — AND, not OR — because
 * an endpoint that both reads and writes should require both.
 *
 * Permissions are carried on the access token, so this costs no database round
 * trip. The trade-off is that a permission change takes effect on the next
 * token refresh (≤15 min); AuthService bumps `tokensValidFrom` when a role
 * changes, which forces that refresh immediately.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const context = getTenantContext();
    if (!context?.userId) throw new ForbiddenError('Not authenticated');
    if (context.roles.includes('OWNER')) return true;

    const held = new Set(context.permissions);
    const missing = required.filter(
      (p) => !held.has(p) && !held.has(wildcardFor(p)) && !held.has('*'),
    );

    if (missing.length) {
      throw new ForbiddenError(
        `Missing permission: ${missing.join(', ')}`,
        'PERMISSION_REQUIRED',
      );
    }
    return true;
  }
}

/** "invoices:create" is also satisfied by the module-wide "invoices:*". */
const wildcardFor = (permission: string) => `${permission.split(':')[0]}:*`;
