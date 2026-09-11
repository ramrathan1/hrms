import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { requireTenantContext, type TenantContext } from '../../infra/tenant/tenant-context';

/**
 * The authenticated caller, read from AsyncLocalStorage rather than the
 * request object — so services get the same value without a parameter.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof TenantContext | undefined, _ctx: ExecutionContext) => {
    const context = requireTenantContext();
    return field ? context[field] : context;
  },
);
