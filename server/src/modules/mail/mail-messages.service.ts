import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain.error';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';
import { JOBS, QUEUES } from '../../infra/queue/queue.constants';
import { paginate } from '../../common/dto/pagination.dto';
import type {
  MessageQueryDto, MoveMessagesDto, SendMailDto, ThreadQueryDto, UpdateFlagsDto,
} from './dto/mail.dto';

export interface MailAddress {
  name: string;
  email: string;
}

@Injectable()
export class MailMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.MAIL) private readonly mailQueue: Queue,
  ) {}

  /* ------------------------------------------------------------ lists */

  /**
   * Conversation list for a folder.
   *
   * Grouped by `threadKey` in SQL rather than in JavaScript, so paging is over
   * conversations and not messages — otherwise page two can repeat a thread that
   * straddled the boundary.
   */
  async threads(query: ThreadQueryDto) {
    const where: Record<string, unknown> = { folder: query.folder ?? 'INBOX' };
    if (query.accountId) where.accountId = query.accountId;
    if (query.starred === 'true') where.isStarred = true;
    if (query.unread === 'true') where.isRead = false;
    if (query.label) where.labels = { has: query.label };
    if (query.q) {
      where.OR = [
        { subject: { contains: query.q, mode: 'insensitive' } },
        { fromName: { contains: query.q, mode: 'insensitive' } },
        { fromEmail: { contains: query.q, mode: 'insensitive' } },
        { body: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const grouped = await this.prisma.db.mailMessage.groupBy({
      by: ['threadKey'],
      where,
      _max: { sentAt: true },
      _count: { _all: true },
      orderBy: { _max: { sentAt: 'desc' } },
      skip: query.skip,
      take: query.limit,
    });

    const distinct = await this.prisma.db.mailMessage.findMany({
      where,
      distinct: ['threadKey'],
      select: { threadKey: true },
    });

    if (grouped.length === 0) {
      return paginate([], distinct.length, query.page, query.limit);
    }

    // One extra query for the messages of the threads on this page.
    const messages = await this.prisma.db.mailMessage.findMany({
      where: { ...where, threadKey: { in: grouped.map((g) => g.threadKey) } },
      orderBy: { sentAt: 'asc' },
    });

    const byThread = new Map<string, typeof messages>();
    for (const m of messages) {
      const list = byThread.get(m.threadKey) ?? [];
      list.push(m);
      byThread.set(m.threadKey, list);
    }

    const threads = grouped.map((g) => {
      const list = byThread.get(g.threadKey) ?? [];
      const latest = list[list.length - 1];
      return {
        threadKey: g.threadKey,
        subject: (latest?.subject ?? '').replace(/^(re|fwd):\s*/i, '') || '(no subject)',
        latest,
        messageCount: g._count._all,
        unread: list.filter((m) => !m.isRead).length,
        starred: list.some((m) => m.isStarred),
        hasAttachments: false,
        participants: [...new Set(list.map((m) => m.fromName))],
      };
    });

    return paginate(threads, distinct.length, query.page, query.limit);
  }

  /** Every message in one conversation, oldest first. */
  async thread(threadKey: string, accountId?: string) {
    const messages = await this.prisma.db.mailMessage.findMany({
      where: { threadKey, ...(accountId ? { accountId } : {}) },
      orderBy: { sentAt: 'asc' },
    });
    if (!messages.length) throw new NotFoundError('Conversation', threadKey);
    return messages;
  }

  async findAll(query: MessageQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.accountId) where.accountId = query.accountId;
    if (query.folder) where.folder = query.folder;
    if (query.threadKey) where.threadKey = query.threadKey;

    const [data, total] = await Promise.all([
      this.prisma.db.mailMessage.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.db.mailMessage.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  /** Unread counts per folder, for the sidebar badges. */
  async folderCounts(accountId?: string) {
    const grouped = await this.prisma.db.mailMessage.groupBy({
      by: ['folder'],
      where: { isRead: false, ...(accountId ? { accountId } : {}) },
      _count: { _all: true },
    });
    return Object.fromEntries(grouped.map((g) => [g.folder, g._count._all]));
  }

  /* ------------------------------------------------------------ flags */

  async setFlags(dto: UpdateFlagsDto) {
    const data: Record<string, unknown> = {};
    if (dto.isRead !== undefined) data.isRead = dto.isRead;
    if (dto.isStarred !== undefined) data.isStarred = dto.isStarred;
    if (!Object.keys(data).length) {
      throw new BusinessRuleError('NOTHING_TO_UPDATE', 'Set isRead or isStarred');
    }
    const res = await this.prisma.db.mailMessage.updateMany({
      where: { id: { in: dto.messageIds } },
      data,
    });
    return { updated: res.count };
  }

  async move(dto: MoveMessagesDto) {
    const res = await this.prisma.db.mailMessage.updateMany({
      where: { id: { in: dto.messageIds } },
      data: { folder: dto.folder },
    });
    return { moved: res.count, folder: dto.folder };
  }

  /** Trash first, delete for good on a second pass — as a mail client behaves. */
  async remove(messageIds: string[]) {
    const messages = await this.prisma.db.mailMessage.findMany({
      where: { id: { in: messageIds } },
      select: { id: true, folder: true },
    });

    const toPurge = messages.filter((m) => m.folder === 'TRASH').map((m) => m.id);
    const toTrash = messages.filter((m) => m.folder !== 'TRASH').map((m) => m.id);

    const [purged, trashed] = await Promise.all([
      toPurge.length
        ? this.prisma.db.mailMessage.deleteMany({ where: { id: { in: toPurge } } })
        : Promise.resolve({ count: 0 }),
      toTrash.length
        ? this.prisma.db.mailMessage.updateMany({
            where: { id: { in: toTrash } },
            data: { folder: 'TRASH' },
          })
        : Promise.resolve({ count: 0 }),
    ]);

    return { movedToTrash: trashed.count, deleted: purged.count };
  }

  /* ------------------------------------------------------------- send */

  /**
   * Queue a message for delivery.
   *
   * The row is written to SENT immediately so the UI has something to show, and
   * the job carries its id — the worker marks it back to DRAFTS if SMTP
   * ultimately refuses it, rather than the message silently vanishing.
   */
  async send(dto: SendMailDto) {
    const ctx = getTenantContext()!;

    const account = await this.prisma.db.mailAccount.findFirst({
      where: dto.accountId ? { id: dto.accountId } : { isDefault: true },
    });
    if (!account) {
      throw new NotFoundError('Mail account — connect one before sending');
    }

    const to = parseAddresses(dto.to);
    if (!to.length) {
      throw new BusinessRuleError('NO_RECIPIENT', 'Add at least one recipient');
    }
    const invalid = to.filter((a) => !isEmail(a.email)).map((a) => a.email);
    if (invalid.length) {
      throw new BusinessRuleError('INVALID_RECIPIENT', `Not a valid address: ${invalid.join(', ')}`);
    }
    if (!dto.subject?.trim() && !dto.body?.trim()) {
      throw new BusinessRuleError('EMPTY_MESSAGE', 'Add a subject or a message');
    }

    const cc = dto.cc ? parseAddresses(dto.cc) : [];

    const message = await this.prisma.db.mailMessage.create({
      data: {
        ...orgScope(),
        accountId: account.id,
        threadKey: dto.threadKey ?? `t-${Date.now().toString(36)}`,
        folder: 'SENT',
        subject: dto.subject?.trim() || '(no subject)',
        fromName: account.displayName,
        fromEmail: account.email,
        toJson: to as unknown as object,
        ccJson: cc.length ? (cc as unknown as object) : undefined,
        body: dto.body ?? '',
        sentAt: new Date(),
        isRead: true,
        labels: [],
      },
    });

    // Replace the draft it came from, if any.
    if (dto.draftId) {
      await this.prisma.db.mailMessage.deleteMany({ where: { id: dto.draftId, isDraft: true } });
    }

    const job = await this.mailQueue.add(JOBS.SEND_MAIL, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      accountId: account.id,
      messageId: message.id,
    });

    return { queued: true, jobId: String(job.id), message };
  }

  /** Save or update a draft. Never queued. */
  async saveDraft(dto: SendMailDto) {
    const account = await this.prisma.db.mailAccount.findFirst({
      where: dto.accountId ? { id: dto.accountId } : { isDefault: true },
    });
    if (!account) throw new NotFoundError('Mail account');

    const payload = {
      accountId: account.id,
      threadKey: dto.threadKey ?? `t-${Date.now().toString(36)}`,
      folder: 'DRAFTS' as const,
      subject: dto.subject?.trim() ?? '',
      fromName: account.displayName,
      fromEmail: account.email,
      toJson: parseAddresses(dto.to ?? '') as unknown as object,
      ccJson: dto.cc ? (parseAddresses(dto.cc) as unknown as object) : undefined,
      body: dto.body ?? '',
      sentAt: new Date(),
      isRead: true,
      isDraft: true,
      labels: [],
    };

    if (dto.draftId) {
      return this.prisma.db.mailMessage.update({ where: { id: dto.draftId }, data: payload });
    }
    return this.prisma.db.mailMessage.create({ data: { ...orgScope(), ...payload } });
  }
}

/* ---------------------------------------------------------------- helpers */

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

/** Accepts "Name <a@b.com>, c@d.com" and normalises both forms. */
export function parseAddresses(raw: string): MailAddress[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^(.*?)\s*<(.+?)>$/.exec(s);
      return m ? { name: m[1].trim() || m[2], email: m[2] } : { name: s, email: s };
    });
}
