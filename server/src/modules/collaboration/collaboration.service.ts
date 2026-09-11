import { Injectable } from '@nestjs/common';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  BusinessRuleError, ConflictError, ForbiddenError, NotFoundError,
} from '../../common/errors/domain.error';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';
import { paginate } from '../../common/dto/pagination.dto';
import type {
  ChannelQueryDto, CreateChannelDto, CreateDirectChannelDto, MessageHistoryDto,
  ReactDto, SendMessageDto, UpdateChannelDto,
} from './dto/collaboration.dto';

type Row = { id: string };

/**
 * Channels and messages.
 *
 * Membership is the authorization boundary, not a UI filter. The old realtime
 * hub broadcast every message to every connected client and let the browser
 * decide what to show — meaning private channels and DMs were on the wire for
 * anyone with a socket. `assertMember()` is what replaces that.
 */
@Injectable()
export class CollaborationService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'channel', ['name', 'description'], ['name', 'createdAt'], 'Channel');
  }

  /* --------------------------------------------------------- channels */

  protected override buildFilters(query: ChannelQueryDto) {
    const ctx = getTenantContext();
    const where: Record<string, unknown> = {};
    if (query.kind) where.kind = query.kind;
    // A private channel is only listed to the people in it. Public channels are
    // discoverable so someone can join them.
    where.OR = [
      { kind: 'PUBLIC' },
      { members: { some: { userId: ctx?.userId ?? '' } } },
    ];
    return where;
  }

  protected override listInclude() {
    return {
      _count: { select: { members: true, messages: true } },
    };
  }

  async createChannel(dto: CreateChannelDto) {
    const ctx = getTenantContext()!;
    const slug = slugify(dto.name);
    if (!slug) {
      throw new BusinessRuleError('INVALID_NAME', 'A channel name needs letters or numbers');
    }

    const existing = await this.prisma.db.channel.findFirst({ where: { slug } });
    if (existing) throw new ConflictError('CHANNEL_EXISTS', `#${slug} already exists`);

    return this.prisma.transaction(async (tx) =>
      tx.channel.create({
        data: {
          ...orgScope(),
          slug,
          name: slug,
          description: dto.description ?? null,
          kind: dto.kind ?? 'PUBLIC',
          createdById: ctx.userId,
          // The creator is always a member, or they'd be locked out of their
          // own private channel.
          members: {
            create: [...new Set([ctx.userId, ...(dto.memberIds ?? [])])].map((userId) => ({ userId })),
          },
        },
        include: { members: true },
      }),
    );
  }

  /**
   * Direct message channel between two people. Deterministic slug, so opening
   * a DM twice reuses the same conversation rather than creating a second one.
   */
  async openDirect(dto: CreateDirectChannelDto) {
    const ctx = getTenantContext()!;
    if (dto.userId === ctx.userId) {
      throw new BusinessRuleError('SELF_DM', 'You cannot open a direct message with yourself');
    }

    const other = await this.prisma.db.user.findFirst({ where: { id: dto.userId } });
    if (!other) throw new NotFoundError('User', dto.userId);

    const slug = `dm-${[ctx.userId, dto.userId].sort().join('-')}`;
    const existing = await this.prisma.db.channel.findFirst({
      where: { slug },
      include: { members: true },
    });
    if (existing) return existing;

    return this.prisma.db.channel.create({
      data: {
        ...orgScope(),
        slug,
        name: other.name,
        kind: 'DIRECT',
        createdById: ctx.userId,
        members: { create: [{ userId: ctx.userId }, { userId: dto.userId }] },
      },
      include: { members: true },
    });
  }

  updateChannel(id: string, dto: UpdateChannelDto) {
    return this.update(id, { description: dto.description, kind: dto.kind });
  }

  async setMembers(channelId: string, userIds: string[]) {
    await this.assertMember(channelId);
    return this.prisma.transaction(async (tx) => {
      await tx.channelMember.deleteMany({ where: { channelId } });
      await tx.channelMember.createMany({
        data: [...new Set(userIds)].map((userId) => ({ channelId, userId })),
        skipDuplicates: true,
      });
      return tx.channel.findFirstOrThrow({
        where: { id: channelId },
        include: { members: { include: { user: { select: { id: true, name: true } } } } },
      });
    });
  }

  /** Join a public channel. Private channels need an invite. */
  async join(channelId: string) {
    const ctx = getTenantContext()!;
    const channel = await this.prisma.db.channel.findFirst({ where: { id: channelId } });
    if (!channel) throw new NotFoundError('Channel', channelId);
    if (channel.kind !== 'PUBLIC') {
      throw new ForbiddenError('That channel is private — ask a member to add you', 'CHANNEL_PRIVATE');
    }
    await this.prisma.db.channelMember.upsert({
      where: { channelId_userId: { channelId, userId: ctx.userId } },
      update: {},
      create: { channelId, userId: ctx.userId },
    });
    return { joined: true, channelId };
  }

  async leave(channelId: string) {
    const ctx = getTenantContext()!;
    await this.prisma.db.channelMember.deleteMany({
      where: { channelId, userId: ctx.userId },
    });
    return { left: true, channelId };
  }

  /** Channels the current user belongs to — what the gateway joins on connect. */
  async myChannelIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.db.channelMember.findMany({
      where: { userId },
      select: { channelId: true },
    });
    return rows.map((r) => r.channelId);
  }

  /**
   * The check that makes chat private. Throws unless the caller is in the
   * channel — every read and write of messages goes through it.
   */
  async assertMember(channelId: string, userId?: string): Promise<void> {
    const uid = userId ?? getTenantContext()?.userId;
    const member = await this.prisma.db.channelMember.findFirst({
      where: { channelId, userId: uid ?? '' },
      select: { channelId: true },
    });
    if (member) return;

    // A public channel is readable without joining; anything else is not.
    const channel = await this.prisma.db.channel.findFirst({
      where: { id: channelId },
      select: { kind: true },
    });
    if (!channel) throw new NotFoundError('Channel', channelId);
    if (channel.kind === 'PUBLIC') return;

    throw new ForbiddenError('You are not a member of that channel', 'NOT_A_MEMBER');
  }

  /* --------------------------------------------------------- messages */

  async history(channelId: string, query: MessageHistoryDto) {
    await this.assertMember(channelId);

    const where: Record<string, unknown> = {
      channelId,
      // Top-level messages only; replies are fetched per thread.
      parentId: query.parentId ?? null,
    };
    if (query.before) where.createdAt = { lt: new Date(query.before) };

    const [data, total] = await Promise.all([
      this.prisma.db.channelMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        include: {
          _count: { select: { replies: true } },
          // Without the author, a transcript is a wall of anonymous text.
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      this.prisma.db.channelMessage.count({ where }),
    ]);

    // Newest-first for paging, oldest-first for reading.
    return paginate(data.reverse(), total, query.page, query.limit);
  }

  async postMessage(channelId: string, dto: SendMessageDto, userId?: string) {
    const uid = userId ?? getTenantContext()!.userId;
    await this.assertMember(channelId, uid);

    const body = dto.body?.trim();
    if (!body) throw new BusinessRuleError('EMPTY_MESSAGE', 'Write something first');
    if (body.length > 4000) {
      throw new BusinessRuleError('MESSAGE_TOO_LONG', 'Messages are limited to 4000 characters');
    }

    if (dto.parentId) {
      const parent = await this.prisma.db.channelMessage.findFirst({
        where: { id: dto.parentId, channelId },
        select: { id: true },
      });
      if (!parent) throw new NotFoundError('Parent message', dto.parentId);
    }

    return this.prisma.db.channelMessage.create({
      data: {
        ...orgScope(),
        channelId,
        authorId: uid,
        parentId: dto.parentId ?? null,
        body,
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  /**
   * Toggle a reaction. Stored as `{ "👍": ["userId", …] }` rather than a count,
   * so the same person cannot react twice and the UI can show who reacted.
   */
  async react(messageId: string, dto: ReactDto, userId?: string) {
    const uid = userId ?? getTenantContext()!.userId;

    const message = await this.prisma.db.channelMessage.findFirst({ where: { id: messageId } });
    if (!message) throw new NotFoundError('Message', messageId);
    await this.assertMember(message.channelId, uid);

    const reactions = { ...((message.reactions as Record<string, string[]>) ?? {}) };
    const holders = new Set(reactions[dto.emoji] ?? []);

    if (holders.has(uid)) holders.delete(uid);
    else holders.add(uid);

    if (holders.size) reactions[dto.emoji] = [...holders];
    else delete reactions[dto.emoji];

    return this.prisma.db.channelMessage.update({
      where: { id: messageId },
      data: { reactions },
    });
  }

  /** Only the author may edit or delete their own message. */
  async editMessage(messageId: string, body: string) {
    const ctx = getTenantContext()!;
    const message = await this.prisma.db.channelMessage.findFirst({ where: { id: messageId } });
    if (!message) throw new NotFoundError('Message', messageId);
    if (message.authorId !== ctx.userId) {
      throw new ForbiddenError('You can only edit your own messages', 'NOT_AUTHOR');
    }
    return this.prisma.db.channelMessage.update({
      where: { id: messageId },
      data: { body: body.trim(), editedAt: new Date() },
    });
  }

  async deleteMessage(messageId: string) {
    const ctx = getTenantContext()!;
    const message = await this.prisma.db.channelMessage.findFirst({ where: { id: messageId } });
    if (!message) throw new NotFoundError('Message', messageId);
    if (message.authorId !== ctx.userId) {
      throw new ForbiddenError('You can only delete your own messages', 'NOT_AUTHOR');
    }
    await this.prisma.db.channelMessage.delete({ where: { id: messageId } });
    return { id: messageId, deleted: true as const };
  }

  async markRead(channelId: string) {
    const ctx = getTenantContext()!;
    await this.prisma.db.channelMember.updateMany({
      where: { channelId, userId: ctx.userId },
      data: { lastReadAt: new Date() },
    });
    return { channelId, readAt: new Date() };
  }
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
