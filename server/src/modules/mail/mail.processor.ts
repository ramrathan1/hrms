import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import * as nodemailer from 'nodemailer';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { runWithTenantContext } from '../../infra/tenant/tenant-context';
import { JOBS, QUEUES } from '../../infra/queue/queue.constants';
import { MailAccountsService, describeMailError } from './mail-accounts.service';

/** Every mail job carries its tenant — a worker has no request to infer one from. */
interface MailJobData {
  organizationId: string;
  userId: string;
  accountId: string;
  messageId?: string;
}

/** How far back a first sync reaches. Full history would be a very long job. */
const INITIAL_SYNC_DAYS = 30;
const MAX_MESSAGES_PER_SYNC = 200;

/**
 * The mail worker.
 *
 * Everything here is slow, flaky, or both: SMTP handshakes, IMAP fetches,
 * providers rate-limiting. None of it belongs on a request, and all of it needs
 * retry with backoff — which is why it is a queue rather than a service call.
 */
@Processor(QUEUES.MAIL)
export class MailProcessor {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: MailAccountsService,
  ) {}

  /* -------------------------------------------------------------- send */

  @Process(JOBS.SEND_MAIL)
  async send(job: Job<MailJobData>): Promise<{ sent: boolean; messageId?: string }> {
    const { organizationId, userId, accountId, messageId } = job.data;

    // Restore the tenant context the request had, or every query below is
    // refused by the Prisma guard — deliberately, since a job without a tenant
    // would otherwise read across all of them.
    return runWithTenantContext(
      { organizationId, userId, roles: [], permissions: [], requestId: `job:${job.id}` },
      async () => {
        const { account, password } = await this.accounts.credentialsFor(accountId);

        const message = messageId
          ? await this.prisma.db.mailMessage.findFirst({ where: { id: messageId } })
          : null;
        if (!message) {
          this.logger.warn(`Job ${job.id}: message ${messageId} is gone — nothing to send`);
          return { sent: false };
        }

        const transport = nodemailer.createTransport({
          host: account.smtpHost,
          port: account.smtpPort,
          secure: account.smtpSecurity === 'SSL/TLS',
          auth: { user: account.username, pass: password },
          connectionTimeout: 20_000,
        });

        try {
          const info = await transport.sendMail({
            from: { name: account.displayName, address: account.email },
            to: toAddressList(message.toJson),
            cc: message.ccJson ? toAddressList(message.ccJson) : undefined,
            subject: message.subject,
            text: message.body,
          });

          await this.prisma.db.mailAccount.update({
            where: { id: account.id },
            data: { status: 'Connected' },
          });

          this.logger.log(`Job ${job.id}: sent ${message.subject} → ${info.messageId}`);
          return { sent: true, messageId: info.messageId };
        } catch (err) {
          const reason = describeMailError(err);

          // On the final attempt, put the message back in Drafts. Leaving it in
          // Sent would tell the user it went out when it did not.
          if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
            await this.prisma.db.mailMessage.update({
              where: { id: message.id },
              data: { folder: 'DRAFTS', isDraft: true },
            });
            await this.prisma.db.mailAccount.update({
              where: { id: account.id },
              data: { status: 'Error' },
            });
            this.logger.error(
              `Job ${job.id}: giving up on "${message.subject}" — ${reason}. Returned to Drafts.`,
            );
          }
          // Rethrow so Bull retries with backoff.
          throw new Error(reason);
        } finally {
          transport.close();
        }
      },
    );
  }

  /* -------------------------------------------------------------- sync */

  @Process(JOBS.SYNC_MAILBOX)
  async sync(job: Job<MailJobData>): Promise<{ fetched: number; stored: number }> {
    const { organizationId, userId, accountId } = job.data;

    return runWithTenantContext(
      { organizationId, userId, roles: [], permissions: [], requestId: `job:${job.id}` },
      async () => {
        const { account, password } = await this.accounts.credentialsFor(accountId);

        const client = new ImapFlow({
          host: account.imapHost,
          port: account.imapPort,
          secure: account.imapSecurity === 'SSL/TLS',
          auth: { user: account.username, pass: password },
          logger: false,
          socketTimeout: 30_000,
        });

        let fetched = 0;
        let stored = 0;

        try {
          await client.connect();
          const lock = await client.getMailboxLock('INBOX');

          try {
            // Incremental after the first run: only what arrived since the last
            // successful sync, so a large mailbox isn't refetched every time.
            const since = account.lastSyncAt
              ? new Date(account.lastSyncAt)
              : new Date(Date.now() - INITIAL_SYNC_DAYS * 86_400_000);

            const uids = await client.search({ since });
            const recent = (uids || []).slice(-MAX_MESSAGES_PER_SYNC);

            for await (const raw of client.fetch(recent, { source: true, uid: true, flags: true })) {
              fetched += 1;
              const uid = String(raw.uid);

              // Idempotent: a re-run must not duplicate what it already has.
              const seen = await this.prisma.db.mailMessage.findFirst({
                where: { accountId: account.id, externalUid: uid },
                select: { id: true },
              });
              if (seen) continue;

              const parsed = await simpleParser(raw.source as Buffer);

              await this.prisma.db.mailMessage.create({
                data: {
                  organizationId,
                  accountId: account.id,
                  // Group by the mail thread headers where present, else subject.
                  threadKey:
                    parsed.references?.[0] ??
                    parsed.inReplyTo ??
                    parsed.messageId ??
                    normaliseSubject(parsed.subject ?? ''),
                  folder: 'INBOX',
                  subject: parsed.subject ?? '(no subject)',
                  fromName: parsed.from?.value?.[0]?.name || parsed.from?.value?.[0]?.address || 'Unknown',
                  fromEmail: parsed.from?.value?.[0]?.address ?? 'unknown@unknown',
                  toJson: (parsed.to
                    ? asArray(parsed.to).flatMap((a) => a.value.map(toAddr))
                    : []) as unknown as object,
                  ccJson: parsed.cc
                    ? (asArray(parsed.cc).flatMap((a) => a.value.map(toAddr)) as unknown as object)
                    : undefined,
                  body: parsed.text ?? stripHtml(parsed.html || ''),
                  sentAt: parsed.date ?? new Date(),
                  isRead: Boolean(raw.flags?.has('\\Seen')),
                  isStarred: Boolean(raw.flags?.has('\\Flagged')),
                  labels: [],
                  externalUid: uid,
                },
              });
              stored += 1;
            }
          } finally {
            lock.release();
          }

          await client.logout();

          await this.prisma.db.mailAccount.update({
            where: { id: account.id },
            data: { lastSyncAt: new Date(), status: 'Connected' },
          });

          this.logger.log(`Job ${job.id}: ${account.email} — ${fetched} fetched, ${stored} new`);
          return { fetched, stored };
        } catch (err) {
          client.close();
          await this.prisma.db.mailAccount.update({
            where: { id: account.id },
            data: { status: 'Error' },
          }).catch(() => undefined);
          throw new Error(describeMailError(err));
        }
      },
    );
  }
}

/* ---------------------------------------------------------------- helpers */

const toAddr = (a: { name?: string; address?: string }) => ({
  name: a.name || a.address || '',
  email: a.address || '',
});

const asArray = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);

function toAddressList(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return (json as { email?: string }[]).map((a) => a.email).filter((e): e is string => Boolean(e));
}

/** "Re: Fwd: Budget" and "Budget" belong to the same conversation. */
const normaliseSubject = (s: string) =>
  `subj:${s.replace(/^((re|fwd|fw)\s*:\s*)+/i, '').trim().toLowerCase()}`;

const stripHtml = (html: string) =>
  html.replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
