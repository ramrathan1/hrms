import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { tenantContextStorage, type TenantContext } from './tenant-context';

/**
 * Opens an AsyncLocalStorage scope for every request.
 *
 * The context starts empty — JwtAuthGuard fills it in once the token is
 * verified. Running the whole request inside the store (rather than creating it
 * in the guard) means the request id is available to the logger and exception
 * filter even on unauthenticated failures.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    res.setHeader('X-Request-Id', requestId);

    const seed: TenantContext = {
      organizationId: '',
      userId: '',
      roles: [],
      permissions: [],
      requestId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    tenantContextStorage.run(seed, () => next());
  }
}
