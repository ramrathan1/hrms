import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Fine gate: the caller must hold every listed permission, e.g.
 * @RequirePermissions('invoices:create'). This is the check that actually
 * governs writes — roles are only a convenient bundle of these.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
