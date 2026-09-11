import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { ForbiddenError } from '../errors/domain.error';
import { getTenantContext } from '../../infra/tenant/tenant-context';

/** Coarse role gate. Runs after JwtAuthGuard has filled the context. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const context = getTenantContext();
    if (!context?.userId) throw new ForbiddenError('Not authenticated');

    // OWNER is deliberately absolute: without it, a misconfigured permission
    // set could lock every administrator out of their own tenant.
    if (context.roles.includes('OWNER')) return true;

    const ok = required.some((r) => context.roles.includes(r));
    if (!ok) {
      throw new ForbiddenError(
        `This action needs one of these roles: ${required.join(', ')}`,
        'ROLE_REQUIRED',
      );
    }
    return true;
  }
}
