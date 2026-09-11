import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base for errors the domain raises deliberately.
 *
 * A machine-readable `code` sits alongside the message so the frontend can
 * branch on the reason ("INSUFFICIENT_LEAVE_BALANCE") instead of matching
 * English prose that will change.
 */
export class DomainError extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: string[],
  ) {
    super({ code, message, details }, status);
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${entity} ${id} was not found` : `${entity} was not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ConflictError extends DomainError {
  constructor(code: string, message: string, details?: string[]) {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

/** 422: the request was well-formed but breaks a rule of the domain. */
export class BusinessRuleError extends DomainError {
  constructor(code: string, message: string, details?: string[]) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'You do not have permission to do that', code = 'FORBIDDEN') {
    super(code, message, HttpStatus.FORBIDDEN);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Not authenticated', code = 'UNAUTHENTICATED') {
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}
