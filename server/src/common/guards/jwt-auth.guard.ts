import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { tenantContextStorage } from '../../infra/tenant/tenant-context';
import type { AccessTokenPayload } from '../../modules/auth/auth.types';

/**
 * Verifies the access token and — critically — populates the tenant context.
 *
 * The organization id comes from the signed token and nowhere else. There is no
 * header, query parameter or body field that can influence which tenant a
 * request reads, which is what makes the Prisma guard trustworthy.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    // Guards are registered globally, which reaches WebSocket handlers too.
    // A socket has no HTTP request to read a bearer token from — it was
    // authenticated during the handshake, and the gateway carries the context
    // itself — so anything that isn't an HTTP call belongs to that path.
    if (ctx.getType() !== 'http') return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const token = extractBearer(req);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      });
    } catch {
      // Don't distinguish expired from malformed — it tells an attacker
      // whether a token was ever valid.
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Wrong token type');
    }

    const store = tenantContextStorage.getStore();
    if (!store) {
      throw new UnauthorizedException('Request context unavailable');
    }

    // Mutate the store opened by TenantMiddleware so everything downstream —
    // Prisma, audit, logging — sees the authenticated identity.
    store.organizationId = payload.org;
    store.userId = payload.sub;
    store.roles = payload.roles ?? [];
    store.permissions = payload.perms ?? [];

    return true;
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  return null;
}
