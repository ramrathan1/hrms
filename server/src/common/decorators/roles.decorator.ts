import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Coarse gate: the caller must hold one of these role keys.
 * Use for whole-module access; use @RequirePermissions for specific actions.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
