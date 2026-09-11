import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ImapFlow } from 'imapflow';
import * as nodemailer from 'nodemailer';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { CryptoService } from '../../infra/crypto/crypto.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { getTenantContext, userScope } from '../../infra/tenant/tenant-context';
import { JOBS, QUEUES } from '../../infra/queue/queue.constants';
import type {
  CreateMailAccountDto, TestConnectionDto, UpdateMailAccountDto,
} from './dto/mail.dto';

/** Presets, so setting up a known provider is one choice rather than six fields. */
export const MAIL_PROVIDERS = [
  { name: 'Gmail', imapHost: 'imap.gmail.com', imapPort: 993, imapSecurity: 'SSL/TLS', smtpHost: 'smtp.gmail.com', smtpPort: 465, smtpSecurity: 'SSL/TLS', note: 'Requires an app password when 2-step verification is on.' },
  { name: 'Outlook / Microsoft 365', imapHost: 'outlook.office365.com', imapPort: 993, imapSecurity: 'SSL/TLS', smtpHost: 'smtp.office365.com', smtpPort: 587, smtpSecurity: 'STARTTLS' },
  { name: 'Yahoo Mail', imapHost: 'imap.mail.yahoo.com', imapPort: 993, imapSecurity: 'SSL/TLS', smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, smtpSecurity: 'SSL/TLS', note: 'Requires an app password.' },
  { name: 'iCloud Mail', imapHost: 'imap.mail.me.com', imapPort: 993, imapSecurity: 'SSL/TLS', smtpHost: 'smtp.mail.me.com', smtpPort: 587, smtpSecurity: 'STARTTLS', note: 'Requires an app-specific password.' },
  { name: 'Zoho Mail', imapHost: 'imap.zoho.com', imapPort: 993, imapSecurity: 'SSL/TLS', smtpHost: 'smtp.zoho.com', smtpPort: 465, smtpSecurity: 'SSL/TLS' },
  { name: 'Fastmail', imapHost: 'imap.fastmail.com', imapPort: 993, imapSecurity: 'SSL/TLS', smtpHost: 'smtp.fastmail.com', smtpPort: 465, smtpSecurity: 'SSL/TLS' },
  { name: 'Custom (IMAP/SMTP)', imapHost: '', imapPort: 993, imapSecurity: 'SSL/TLS', smtpHost: '', smtpPort: 587, smtpSecurity: 'STARTTLS' },
] as const;

export interface ConnectionStep {
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * Mail accounts.
 *
 * These are USER-scoped: the Prisma extension filters them by organization *and*
 * user, so one person cannot read another's mailbox configuration even inside
 * the same tenant. The password is encrypted at rest and never leaves the
 * server — `toPublic()` is the only shape the API returns.
 */
@Injectable()
export class MailAccountsService {
  private readonly logger = new Logger(MailAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    @InjectQueue(QUEUES.MAIL) private readonly mailQueue: Queue,
  ) {}

  providers() {
    return MAIL_PROVIDERS;
  }

  async findAll() {
    const accounts = await this.prisma.db.mailAccount.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return accounts.map(toPublic);
  }

  async findOne(id: string) {
    const account = await this.prisma.db.mailAccount.findFirst({ where: { id } });
    if (!account) throw new NotFoundError('Mail account', id);
    return toPublic(account);
  }

  async create(dto: CreateMailAccountDto) {
    const ctx = getTenantContext()!;

    const existing = await this.prisma.db.mailAccount.findFirst({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictError('ACCOUNT_EXISTS', `${dto.email} is already connected`);
    }

    const count = await this.prisma.db.mailAccount.count();

    const account = await this.prisma.transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.mailAccount.updateMany({
          where: { userId: ctx.userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.mailAccount.create({
        data: {
          ...userScope(),
          displayName: dto.displayName,
          email: dto.email.toLowerCase(),
          provider: dto.provider ?? 'Custom (IMAP/SMTP)',
          imapHost: dto.imapHost,
          imapPort: dto.imapPort ?? 993,
          imapSecurity: dto.imapSecurity ?? 'SSL/TLS',
          smtpHost: dto.smtpHost,
          smtpPort: dto.smtpPort ?? 587,
          smtpSecurity: dto.smtpSecurity ?? 'STARTTLS',
          username: dto.username ?? dto.email.toLowerCase(),
          secretCipher: dto.password ? this.crypto.encrypt(dto.password) : null,
          signature: dto.signature ?? null,
          isDefault: dto.isDefault ?? count === 0,
          status: 'Not connected',
        },
      });
    });

    return toPublic(account);
  }

  async update(id: string, dto: UpdateMailAccountDto) {
    const ctx = getTenantContext()!;
    await this.findOne(id);

    const account = await this.prisma.transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.mailAccount.updateMany({
          where: { userId: ctx.userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.mailAccount.update({
        where: { id },
        data: {
          ...(dto.displayName ? { displayName: dto.displayName } : {}),
          ...(dto.provider ? { provider: dto.provider } : {}),
          ...(dto.imapHost ? { imapHost: dto.imapHost } : {}),
          ...(dto.imapPort ? { imapPort: dto.imapPort } : {}),
          ...(dto.imapSecurity ? { imapSecurity: dto.imapSecurity } : {}),
          ...(dto.smtpHost ? { smtpHost: dto.smtpHost } : {}),
          ...(dto.smtpPort ? { smtpPort: dto.smtpPort } : {}),
          ...(dto.smtpSecurity ? { smtpSecurity: dto.smtpSecurity } : {}),
          ...(dto.username ? { username: dto.username } : {}),
          ...(dto.signature !== undefined ? { signature: dto.signature } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          // An empty password means "leave it alone", not "clear it".
          ...(dto.password ? { secretCipher: this.crypto.encrypt(dto.password) } : {}),
        },
      });
    });

    return toPublic(account);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.db.mailAccount.delete({ where: { id } });
    return { id, deleted: true as const };
  }

  /* ------------------------------------------------------ connection */

  /**
   * Test a connection for real: open IMAP, then verify SMTP.
   *
   * Reported step by step, because "it didn't work" is useless when the cause
   * could be the host, the port, TLS, or the password — and for most providers
   * the answer is "you need an app password", which only shows up as an auth
   * failure on a host that resolves fine.
   */
  async testConnection(dto: TestConnectionDto): Promise<{ ok: boolean; steps: ConnectionStep[] }> {
    const steps: ConnectionStep[] = [];

    // When testing a saved account, fall back to the stored password.
    let password = dto.password;
    if (!password && dto.accountId) {
      const saved = await this.prisma.db.mailAccount.findFirst({ where: { id: dto.accountId } });
      password = this.crypto.tryDecrypt(saved?.secretCipher) ?? undefined;
    }

    if (!password) {
      steps.push({ label: 'Credentials', ok: false, detail: 'No password supplied or stored' });
      return { ok: false, steps };
    }

    /* IMAP */
    const imap = new ImapFlow({
      host: dto.imapHost,
      port: dto.imapPort ?? 993,
      secure: (dto.imapSecurity ?? 'SSL/TLS') === 'SSL/TLS',
      auth: { user: dto.username ?? dto.email, pass: password },
      logger: false,
      // Fail fast: a wrong host would otherwise hang the request.
      socketTimeout: 15_000,
      greetingTimeout: 10_000,
    });

    try {
      await imap.connect();
      const mailboxes = await imap.list();
      steps.push({
        label: 'IMAP',
        ok: true,
        detail: `${dto.imapHost}:${dto.imapPort ?? 993} — ${mailboxes.length} mailboxes`,
      });
      await imap.logout().catch(() => undefined);
    } catch (err) {
      steps.push({ label: 'IMAP', ok: false, detail: describeMailError(err) });
      imap.close();
    }

    /* SMTP */
    try {
      const transport = nodemailer.createTransport({
        host: dto.smtpHost,
        port: dto.smtpPort ?? 587,
        secure: (dto.smtpSecurity ?? 'STARTTLS') === 'SSL/TLS',
        auth: { user: dto.username ?? dto.email, pass: password },
        connectionTimeout: 15_000,
        greetingTimeout: 10_000,
      });
      await transport.verify();
      transport.close();
      steps.push({
        label: 'SMTP',
        ok: true,
        detail: `${dto.smtpHost}:${dto.smtpPort ?? 587} — ready to send`,
      });
    } catch (err) {
      steps.push({ label: 'SMTP', ok: false, detail: describeMailError(err) });
    }

    const ok = steps.every((s) => s.ok);

    if (dto.accountId) {
      await this.prisma.db.mailAccount.update({
        where: { id: dto.accountId },
        data: { status: ok ? 'Connected' : 'Error', ...(ok ? { lastSyncAt: new Date() } : {}) },
      });
    }

    return { ok, steps };
  }

  /** Queue a mailbox sync. Returns immediately — IMAP is far too slow inline. */
  async requestSync(accountId: string) {
    const account = await this.findOne(accountId);
    const ctx = getTenantContext()!;

    const job = await this.mailQueue.add(JOBS.SYNC_MAILBOX, {
      // A job runs outside any request, so it carries the tenant with it.
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      accountId: account.id,
    });

    return { queued: true, jobId: String(job.id), accountId: account.id };
  }

  /** Decrypted credentials, for the worker only. Never reachable from a controller. */
  async credentialsFor(accountId: string) {
    const account = await this.prisma.db.mailAccount.findFirst({ where: { id: accountId } });
    if (!account) throw new NotFoundError('Mail account', accountId);
    const password = this.crypto.tryDecrypt(account.secretCipher);
    if (!password) {
      throw new ConflictError(
        'NO_CREDENTIALS',
        'This account has no usable password stored — reconnect it',
      );
    }
    return { account, password };
  }
}

/** The only shape the API returns: no cipher, no password, ever. */
function toPublic<T extends { secretCipher?: string | null }>(account: T) {
  const { secretCipher, ...rest } = account;
  return { ...rest, hasCredentials: Boolean(secretCipher) };
}

/**
 * Turn a mail library error into something a person can act on. These libraries
 * throw fairly raw socket errors, and "ECONNREFUSED" is not an instruction.
 */
export function describeMailError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  switch (e?.code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'That hostname could not be resolved — check the server address';
    case 'ECONNREFUSED':
      return 'The server refused the connection — check the port';
    case 'ETIMEDOUT':
    case 'ESOCKETTIMEDOUT':
      return 'The connection timed out — check the host, port and whether a firewall is in the way';
    case 'EAUTH':
      return 'Authentication failed — most providers require an app password rather than your normal one';
    case 'ESOCKET':
      return 'TLS negotiation failed — check whether this port expects SSL/TLS or STARTTLS';
    default:
      if (e?.responseCode === 535) {
        return 'Authentication rejected — most providers require an app password';
      }
      return e?.message ?? 'The connection failed';
  }
}
