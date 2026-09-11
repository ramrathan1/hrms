import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';

import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  getTenantContext,
  orgScope,
  runUnscoped,
  runWithTenantContext,
} from '../../infra/tenant/tenant-context';
import {
  BusinessRuleError,
  ConflictError,
  UnauthorizedError,
} from '../../common/errors/domain.error';
import type {
  AccessTokenPayload,
  AuthTokens,
  AuthenticatedUser,
  RefreshTokenPayload,
} from './auth.types';
import type { ChangePasswordDto, LoginDto, RegisterOrganizationDto } from './dto/auth.dto';
import { SYSTEM_PERMISSIONS, SYSTEM_ROLES } from '../rbac/rbac.constants';

/** Cost factor 10, as specified. */
const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /* -------------------------------------------------------------- sign in */

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
    // Resolving a login is the one genuinely cross-tenant read: we don't know
    // the tenant until we've found the user.
    const candidates = await runUnscoped(() =>
      this.prisma.unsafe.user.findMany({
        where: {
          email: dto.email.toLowerCase(),
          status: 'ACTIVE',
          organization: dto.organizationSlug
            ? { slug: dto.organizationSlug, status: 'ACTIVE' }
            : { status: 'ACTIVE' },
        },
        include: { organization: true },
      }),
    );

    // Always run a hash comparison, even with no match, so response time does
    // not reveal whether an address is registered.
    if (candidates.length === 0) {
      await bcrypt.compare(dto.password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
      throw new UnauthorizedError('Email or password is incorrect', 'INVALID_CREDENTIALS');
    }

    if (candidates.length > 1) {
      throw new BusinessRuleError(
        'ORGANIZATION_REQUIRED',
        'That address belongs to more than one organization — include organizationSlug',
        candidates.map((c) => c.organization.slug),
      );
    }

    const user = candidates[0];
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedError('Email or password is incorrect', 'INVALID_CREDENTIALS');
    }

    return runWithTenantContext(
      {
        organizationId: user.organizationId,
        userId: user.id,
        roles: [],
        permissions: [],
        requestId: getTenantContext()?.requestId ?? randomUUID(),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      async () => {
        const profile = await this.buildProfile(user.id);
        const tokens = await this.issueTokens(profile, meta);

        await this.prisma.db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await this.prisma.db.auditLog.create({
          data: {
            ...orgScope(),
            actorId: user.id,
            action: 'LOGIN',
            entity: 'User',
            entityId: user.id,
            summary: `${user.email} signed in`,
            ip: meta.ip,
            userAgent: meta.userAgent,
          },
        });

        return { user: profile, ...tokens };
      },
    );
  }

  /* -------------------------------------------------------------- refresh */

  /**
   * Rotating refresh with reuse detection.
   *
   * Each refresh token is single-use: exchanging it revokes it and issues a
   * successor. Presenting an already-rotated token means it was captured, so
   * the entire session family is revoked rather than just refusing the call.
   */
  async refresh(rawToken: string, meta: { ip?: string; userAgent?: string }): Promise<AuthTokens & { user: AuthenticatedUser }> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(rawToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedError('Refresh token is invalid or expired', 'INVALID_REFRESH_TOKEN');
    }
    if (payload.typ !== 'refresh') {
      throw new UnauthorizedError('Wrong token type', 'INVALID_REFRESH_TOKEN');
    }

    const tokenHash = hashToken(rawToken);

    return runWithTenantContext(
      {
        organizationId: payload.org,
        userId: payload.sub,
        roles: [],
        permissions: [],
        requestId: getTenantContext()?.requestId ?? randomUUID(),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      async () => {
        const stored = await this.prisma.db.refreshToken.findFirst({ where: { tokenHash } });

        if (!stored) {
          throw new UnauthorizedError('Refresh token is not recognised', 'INVALID_REFRESH_TOKEN');
        }

        if (stored.revokedAt) {
          this.logger.warn(
            `Refresh token reuse detected for user ${payload.sub} — revoking all sessions`,
          );
          await this.revokeAllSessions(payload.sub);
          throw new UnauthorizedError(
            'This session has been closed for security. Please sign in again.',
            'REFRESH_TOKEN_REUSED',
          );
        }

        if (stored.expiresAt < new Date()) {
          throw new UnauthorizedError('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
        }

        const profile = await this.buildProfile(payload.sub);
        const tokens = await this.issueTokens(profile, meta);

        await this.prisma.db.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date(), replacedById: tokens.refreshTokenId },
        });

        return {
          user: profile,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          tokenType: 'Bearer' as const,
        };
      },
    );
  }

  /* ------------------------------------------------------------- sign out */

  async logout(rawToken?: string): Promise<{ ok: true }> {
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await this.prisma.db.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { ok: true };
  }

  async logoutEverywhere(userId: string): Promise<{ revoked: number }> {
    return { revoked: await this.revokeAllSessions(userId) };
  }

  /* ------------------------------------------------------------ passwords */

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ ok: true }> {
    const user = await this.prisma.db.user.findFirst({ where: { id: userId } });
    if (!user) throw new UnauthorizedError();

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      // The frontend's old endpoint let anyone set a password on an account
      // with none. Current password is mandatory here, always.
      throw new UnauthorizedError('Current password is incorrect', 'INVALID_CREDENTIALS');
    }

    await this.prisma.db.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
        // Invalidate every existing access token immediately.
        tokensValidFrom: new Date(),
      },
    });
    await this.revokeAllSessions(userId);
    return { ok: true };
  }

  /* --------------------------------------------------------- registration */

  /** Creates a tenant plus its owner, its system roles and its permissions. */
  async registerOrganization(dto: RegisterOrganizationDto) {
    const slug = slugify(dto.organizationName);

    const existing = await runUnscoped(() =>
      this.prisma.unsafe.organization.findUnique({ where: { slug } }),
    );
    if (existing) {
      throw new ConflictError('ORGANIZATION_EXISTS', `An organization named "${dto.organizationName}" already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const org = await runUnscoped(() =>
      this.prisma.unsafe.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: { name: dto.organizationName, slug },
        });

        // Permissions are global reference rows, created once.
        await tx.permission.createMany({
          data: SYSTEM_PERMISSIONS.map((p) => ({
            key: p.key,
            module: p.module,
            action: p.action,
            description: p.description,
          })),
          skipDuplicates: true,
        });
        const allPermissions = await tx.permission.findMany();
        const byKey = new Map(allPermissions.map((p) => [p.key, p.id]));

        for (const role of SYSTEM_ROLES) {
          await tx.role.create({
            data: {
              organizationId: organization.id,
              key: role.key,
              name: role.name,
              description: role.description,
              isSystem: true,
              permissions: {
                create: role.permissions
                  .flatMap((pattern) => expandPattern(pattern, allPermissions.map((p) => p.key)))
                  .map((key) => byKey.get(key))
                  .filter((id): id is string => Boolean(id))
                  .map((permissionId) => ({ permissionId })),
              },
            },
          });
        }

        const ownerRole = await tx.role.findFirstOrThrow({
          where: { organizationId: organization.id, key: 'OWNER' },
        });

        const user = await tx.user.create({
          data: {
            organizationId: organization.id,
            email: dto.email.toLowerCase(),
            passwordHash,
            name: dto.name,
            roles: { create: { roleId: ownerRole.id } },
          },
        });

        return { organization, user };
      }),
    );

    return {
      organizationId: org.organization.id,
      organizationSlug: org.organization.slug,
      userId: org.user.id,
    };
  }

  /* ------------------------------------------------------------- internals */

  async buildProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.db.user.findFirstOrThrow({
      where: { id: userId },
      include: {
        organization: { select: { id: true, name: true } },
        employee: { select: { id: true } },
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });

    const roles = user.roles.map((r) => r.role.key);
    const permissions = [
      ...new Set(
        user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organization.id,
      organizationName: user.organization.name,
      roles,
      permissions,
      employeeId: user.employee?.id ?? null,
    };
  }

  private async issueTokens(
    profile: AuthenticatedUser,
    meta: { ip?: string; userAgent?: string },
  ): Promise<AuthTokens & { refreshTokenId: string }> {
    const accessPayload: AccessTokenPayload = {
      sub: profile.id,
      org: profile.organizationId,
      email: profile.email,
      roles: profile.roles,
      perms: profile.permissions,
      typ: 'access',
    };

    const accessTtl = this.config.get<string>('jwt.accessTtl', '15m');
    const refreshTtl = this.config.get<string>('jwt.refreshTtl', '7d');

    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = {
      sub: profile.id,
      org: profile.organizationId,
      jti,
      typ: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: accessTtl as never,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshTtl as never,
      }),
    ]);

    // Only the hash is stored: a database leak must not yield usable sessions.
    const stored = await this.prisma.db.refreshToken.create({
      data: {
        ...orgScope(),
        userId: profile.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + ttlToMs(refreshTtl)),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenId: stored.id,
      expiresIn: Math.floor(ttlToMs(accessTtl) / 1000),
      tokenType: 'Bearer',
    };
  }

  private async revokeAllSessions(userId: string): Promise<number> {
    const res = await this.prisma.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.count;
  }
}

/* ---------------------------------------------------------------- helpers */

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `org-${Date.now()}`;

/** "invoices:*" → every invoices permission; "*" → all. */
function expandPattern(pattern: string, allKeys: string[]): string[] {
  if (pattern === '*') return allKeys;
  if (pattern.endsWith(':*')) {
    const module = pattern.slice(0, -2);
    return allKeys.filter((k) => k.startsWith(`${module}:`));
  }
  return [pattern];
}

function ttlToMs(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]]!;
  return n * unit;
}
