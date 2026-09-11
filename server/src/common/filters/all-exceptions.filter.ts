import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { PrismaTenantNotFound } from '../../infra/prisma/prisma.service';
import { getTenantContext } from '../../infra/tenant/tenant-context';

/** Prisma error codes worth translating into something a client can act on. */
const PRISMA_MAP: Record<string, { status: HttpStatus; code: string; message: string }> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    code: 'DUPLICATE',
    message: 'A record with those details already exists',
  },
  P2003: {
    status: HttpStatus.CONFLICT,
    code: 'FOREIGN_KEY',
    message: 'That change references something that does not exist',
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    code: 'NOT_FOUND',
    message: 'Record not found',
  },
  P2014: {
    status: HttpStatus.CONFLICT,
    code: 'RELATION_VIOLATION',
    message: 'That change would break a required relation',
  },
};

/**
 * Single exit point for every error.
 *
 * Two rules: the response shape never varies, and internal detail never leaks.
 * A 500 tells the caller a request id; the stack goes to the log where it can
 * be correlated by that id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();
    const requestId = getTenantContext()?.requestId ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong on our side';
    let details: string[] | undefined;

    if (exception instanceof PrismaTenantNotFound) {
      // Cross-tenant access is reported as "not found" on purpose: confirming
      // the row exists elsewhere would itself be a disclosure.
      status = HttpStatus.NOT_FOUND;
      code = 'NOT_FOUND';
      message = `${exception.model} not found`;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        code = defaultCodeFor(status);
      } else {
        const b = body as Record<string, unknown>;
        code = (b.code as string) ?? defaultCodeFor(status);
        // class-validator hands back message: string[]
        if (Array.isArray(b.message)) {
          details = b.message as string[];
          message = 'Request validation failed';
          code = 'VALIDATION_FAILED';
        } else {
          message = (b.message as string) ?? exception.message;
        }
        if (Array.isArray(b.details)) details = b.details as string[];
      }
    } else if (isPrismaKnownError(exception)) {
      // P1xxx are connection/engine failures, not the caller's fault. 503 says
      // "try again" where 500 says "we're broken" — and it keeps a database
      // outage out of the error-rate metrics for application bugs.
      if (/^P1\d{3}$/.test(exception.code)) {
        this.logger.error(`Database unavailable (${exception.code}): ${exception.message}`);
        res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          code: 'DATABASE_UNAVAILABLE',
          message: 'The service is temporarily unavailable. Please try again.',
          path: req.originalUrl,
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const mapped = PRISMA_MAP[exception.code];
      if (mapped) {
        status = mapped.status;
        code = mapped.code;
        message = mapped.message;
        const target = (exception.meta as { target?: string[] })?.target;
        if (target?.length) details = [`Conflicting field(s): ${target.join(', ')}`];
      } else {
        this.logger.error(`Unmapped Prisma error ${exception.code}: ${exception.message}`);
      }
    }

    if (status >= 500) {
      this.logger.error(
        JSON.stringify({
          requestId,
          method: req.method,
          path: req.originalUrl,
          message: exception instanceof Error ? exception.message : String(exception),
        }),
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (status === 403 || status === 401) {
      this.logger.warn(
        JSON.stringify({ requestId, method: req.method, path: req.originalUrl, status, code }),
      );
    }

    res.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details?.length ? { details } : {}),
      path: req.originalUrl,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}

function defaultCodeFor(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHENTICATED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'UNPROCESSABLE';
    case 429: return 'RATE_LIMITED';
    default: return 'ERROR';
  }
}

function isPrismaKnownError(e: unknown): e is { code: string; message: string; meta?: unknown } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    typeof (e as { code: unknown }).code === 'string' &&
    /^P\d{4}$/.test((e as { code: string }).code)
  );
}
