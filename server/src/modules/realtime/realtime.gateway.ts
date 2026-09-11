import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
  SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { runWithTenantContext } from '../../infra/tenant/tenant-context';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CollaborationService } from '../collaboration/collaboration.service';
import { PresenceService } from './presence.service';
import type { AccessTokenPayload } from '../auth/auth.types';

/** What we hang off a verified socket. */
interface SocketContext {
  organizationId: string;
  userId: string;
  name: string;
  email: string;
}

type AuthedSocket = Socket & { ctx?: SocketContext };

/* Room naming. Everything is prefixed by organization, so a broadcast can never
   escape its tenant even if a room id were guessed. */
const orgRoom = (org: string) => `org:${org}`;
const channelRoom = (org: string, channelId: string) => `org:${org}:ch:${channelId}`;
const meetRoom = (org: string, key: string) => `org:${org}:meet:${key}`;

/**
 * The realtime hub.
 *
 * Two things the previous implementation got wrong, both fixed here:
 *
 * 1. It accepted whatever identity a client claimed in a `hello` message. Here
 *    the socket is authenticated from a JWT during the handshake and refused if
 *    that fails — the client cannot assert who it is.
 * 2. It broadcast every chat message to every connected socket and left the
 *    browser to filter. Here a socket only joins channel rooms it is a member
 *    of, so a private conversation never reaches a non-member's wire.
 */
@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: true, credentials: true },
  // Sensible for a chat/presence workload; a dead connection is reaped in ~45s.
  pingInterval: 25_000,
  pingTimeout: 20_000,
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly presence: PresenceService,
    private readonly collaboration: CollaborationService,
    private readonly prisma: PrismaService,
  ) {}

  /** Shorthand for the one thing this gateway reads directly. */
  private get users() {
    return this.prisma.db.user;
  }

  /* ------------------------------------------------------- lifecycle */

  async handleConnection(socket: AuthedSocket): Promise<void> {
    const token = extractToken(socket);
    if (!token) return this.reject(socket, 'No access token supplied');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      });
    } catch {
      return this.reject(socket, 'Invalid or expired access token');
    }
    if (payload.typ !== 'access') return this.reject(socket, 'Wrong token type');

    const ctx: SocketContext = {
      organizationId: payload.org,
      userId: payload.sub,
      // Filled in below. The access token carries no display name, and a
      // presence list of email addresses is not a presence list.
      name: payload.email,
      email: payload.email,
    };
    socket.ctx = ctx;

    // One lookup per connection, not per message.
    try {
      const user = await runWithTenantContext(
        { ...ctx, roles: payload.roles ?? [], permissions: payload.perms ?? [], requestId: `ws:${socket.id}` },
        // Awaited *inside* the scope on purpose: Prisma builds the query
        // lazily, so returning the un-awaited promise would run it after the
        // AsyncLocalStorage scope had already closed and the tenant guard
        // would refuse it.
        async () => this.users.findFirst({ where: { id: ctx.userId }, select: { name: true } }),
      );
      if (user?.name) ctx.name = user.name;
    } catch (err) {
      // Falling back to the email is worse but still usable; a database blip
      // shouldn't cost the user their connection.
      this.logger.warn(`Could not resolve display name: ${(err as Error).message}`);
    }

    // Tenant-wide room, for notifications that should reach everyone.
    await socket.join(orgRoom(ctx.organizationId));

    // Join only the channels this user actually belongs to. This is the
    // membership boundary — everything else about chat privacy follows from it.
    //
    // Everything below is wrapped: a database blip must drop this one socket,
    // not take the process down with an unhandled rejection. Connection handlers
    // are async and Nest does not catch what they throw.
    try {
      // Presence first, then `ready`. A client that acts the moment it is told
      // it is ready — joining a meeting, walking into an office room — would
      // otherwise find no presence entry to update, and the join would be
      // silently dropped.
      await this.presence.join(ctx.organizationId, {
        userId: ctx.userId,
        name: ctx.name,
        socketId: socket.id,
        officeRoom: null,
        meetRoom: null,
        since: Date.now(),
      });

      await runWithTenantContext(
        { ...ctx, roles: payload.roles ?? [], permissions: payload.perms ?? [], requestId: `ws:${socket.id}` },
        async () => {
          const channelIds = await this.collaboration.myChannelIds(ctx.userId);
          await Promise.all(
            channelIds.map((id) => socket.join(channelRoom(ctx.organizationId, id))),
          );
          socket.emit('ready', { userId: ctx.userId, channels: channelIds });
        },
      );

      await this.broadcastPresence(ctx.organizationId);

      this.logger.log(`Connected ${ctx.email} (${socket.id})`);
    } catch (err) {
      this.logger.error(
        `Failed to set up socket ${socket.id} for ${ctx.email}: ${(err as Error).message}`,
      );
      socket.emit('error', {
        message: 'Could not open the realtime session. Please try again.',
      });
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: AuthedSocket): Promise<void> {
    const ctx = socket.ctx;
    if (!ctx) return;

    // Tell anyone in a call with them, so their tile is removed rather than
    // freezing on the last frame.
    const entry = await this.presence
      .list(ctx.organizationId)
      .then((all) => all.find((e) => e.socketId === socket.id))
      .catch(() => undefined);

    if (entry?.meetRoom) {
      this.server
        .to(meetRoom(ctx.organizationId, entry.meetRoom))
        .emit('meet:peer-left', { socketId: socket.id, userId: ctx.userId });
    }

    try {
      await this.presence.leave(ctx.organizationId, socket.id);
      await this.broadcastPresence(ctx.organizationId);
    } catch (err) {
      this.logger.warn(`Presence cleanup failed for ${socket.id}: ${(err as Error).message}`);
    }
    this.logger.log(`Disconnected ${ctx.email} (${socket.id})`);
  }

  /* ------------------------------------------------------------ chat */

  @SubscribeMessage('chat:send')
  async chatSend(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { channelId: string; body: string; parentId?: string },
  ) {
    const ctx = this.require(socket);

    return this.withContext(socket, async () => {
      // Membership is re-checked on every send: a socket could have been
      // removed from the channel since it connected.
      const message = await this.collaboration.postMessage(
        data.channelId,
        { body: data.body, parentId: data.parentId },
        ctx.userId,
      );

      // Scoped emit — only sockets in this channel's room receive it.
      this.server
        .to(channelRoom(ctx.organizationId, data.channelId))
        .emit('chat:new', { message, author: { id: ctx.userId, name: ctx.name } });

      return { ok: true, messageId: message.id };
    });
  }

  @SubscribeMessage('chat:react')
  async chatReact(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { messageId: string; emoji: string },
  ) {
    const ctx = this.require(socket);
    return this.withContext(socket, async () => {
      const message = await this.collaboration.react(
        data.messageId,
        { emoji: data.emoji },
        ctx.userId,
      );
      this.server
        .to(channelRoom(ctx.organizationId, message.channelId))
        .emit('chat:update', { message });
      return { ok: true };
    });
  }

  @SubscribeMessage('chat:typing')
  async chatTyping(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    const ctx = this.require(socket);
    // Not persisted and not acknowledged — a typing indicator that outlives the
    // typing is worse than none.
    socket
      .to(channelRoom(ctx.organizationId, data.channelId))
      .emit('chat:typing', { channelId: data.channelId, userId: ctx.userId, name: ctx.name });
    return { ok: true };
  }

  /** Joining a channel mid-session, after being added to it. */
  @SubscribeMessage('chat:subscribe')
  async chatSubscribe(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    const ctx = this.require(socket);
    return this.withContext(socket, async () => {
      await this.collaboration.assertMember(data.channelId, ctx.userId);
      await socket.join(channelRoom(ctx.organizationId, data.channelId));
      return { ok: true, channelId: data.channelId };
    });
  }

  /* -------------------------------------------------- virtual office */

  @SubscribeMessage('office:move')
  async officeMove(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { roomId: string | null },
  ) {
    const ctx = this.require(socket);
    await this.presence.update(ctx.organizationId, socket.id, { officeRoom: data.roomId ?? null });

    const occupancy = await this.presence.officeOccupancy(ctx.organizationId);
    this.server.to(orgRoom(ctx.organizationId)).emit('office:occupancy', { rooms: occupancy });
    await this.broadcastPresence(ctx.organizationId);
    return { ok: true, roomId: data.roomId ?? null };
  }

  /* --------------------------------------------------------- meetings */

  @SubscribeMessage('meet:join')
  async meetJoin(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { roomKey: string },
  ) {
    const ctx = this.require(socket);
    const room = meetRoom(ctx.organizationId, data.roomKey);

    await socket.join(room);
    await this.presence.update(ctx.organizationId, socket.id, { meetRoom: data.roomKey });

    // Hand the joiner the existing peers, and tell them someone arrived. The
    // joiner initiates the offers, which keeps the negotiation one-directional.
    const peers = (await this.presence.peersInMeeting(ctx.organizationId, data.roomKey))
      .filter((p) => p.socketId !== socket.id)
      .map((p) => ({ socketId: p.socketId, userId: p.userId, name: p.name }));

    socket.to(room).emit('meet:peer-joined', {
      socketId: socket.id,
      userId: ctx.userId,
      name: ctx.name,
    });
    await this.broadcastPresence(ctx.organizationId);

    // Hand over the board and the chat as they stand, so a late joiner doesn't
    // stare at a blank canvas while everyone else discusses a diagram.
    const [strokes, chat] = await Promise.all([
      this.presence.strokes(ctx.organizationId, data.roomKey).catch(() => []),
      this.presence.chatHistory(ctx.organizationId, data.roomKey).catch(() => []),
    ]);
    socket.emit('wb:init', { roomKey: data.roomKey, strokes });

    return { ok: true, peers, strokes, chat };
  }

  /**
   * Chat inside a call.
   *
   * Scoped to the meeting room, so only people who actually joined the call
   * receive it — and checked against presence rather than trusting the room key
   * the client sends, which anyone could guess.
   */
  @SubscribeMessage('meet:chat')
  async meetChat(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { roomKey: string; body: string },
  ) {
    const ctx = this.require(socket);

    const entry = (await this.presence.list(ctx.organizationId)).find(
      (e) => e.socketId === socket.id,
    );
    if (!entry?.meetRoom || entry.meetRoom !== data.roomKey) {
      return { ok: false, error: 'Join the meeting before writing in its chat' };
    }

    const body = String(data.body ?? '').trim().slice(0, 4000);
    if (!body) return { ok: false, error: 'Write something first' };

    const message = {
      id: `mc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      roomKey: data.roomKey,
      userId: ctx.userId,
      name: ctx.name,
      body,
      at: new Date().toISOString(),
    };

    await this.presence.addChatMessage(ctx.organizationId, data.roomKey, message);
    this.server.to(meetRoom(ctx.organizationId, data.roomKey)).emit('meet:chat', { message });
    return { ok: true, messageId: message.id };
  }

  @SubscribeMessage('meet:leave')
  async meetLeave(@ConnectedSocket() socket: AuthedSocket) {
    const ctx = this.require(socket);
    const entry = (await this.presence.list(ctx.organizationId)).find(
      (e) => e.socketId === socket.id,
    );

    if (entry?.meetRoom) {
      const room = meetRoom(ctx.organizationId, entry.meetRoom);
      socket.to(room).emit('meet:peer-left', { socketId: socket.id, userId: ctx.userId });
      await socket.leave(room);
    }
    await this.presence.update(ctx.organizationId, socket.id, { meetRoom: null });
    await this.broadcastPresence(ctx.organizationId);
    return { ok: true };
  }

  /**
   * WebRTC signalling relay.
   *
   * Offers, answers and ICE candidates are forwarded verbatim to one named
   * peer — the server never inspects or stores them. Media itself is
   * peer-to-peer and never touches this process.
   */
  @SubscribeMessage('rtc:signal')
  rtcSignal(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { to: string; signal: unknown },
  ) {
    const ctx = this.require(socket);
    const target = this.server.sockets.sockets.get(data.to) as AuthedSocket | undefined;

    // Only relay within the same tenant — a socket id from another organization
    // must not be reachable.
    if (!target || target.ctx?.organizationId !== ctx.organizationId) {
      return { ok: false, error: 'That peer is not available' };
    }

    target.emit('rtc:signal', {
      from: socket.id,
      userId: ctx.userId,
      signal: data.signal,
    });
    return { ok: true };
  }

  /* ------------------------------------------------------- whiteboard */

  @SubscribeMessage('wb:stroke')
  async wbStroke(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { roomKey: string; stroke: unknown },
  ) {
    const ctx = this.require(socket);
    const room = meetRoom(ctx.organizationId, data.roomKey);

    // Only people actually in the room may draw on its board — the old hub let
    // any client draw on, or clear, any whiteboard.
    if (!socket.rooms.has(room)) {
      return { ok: false, error: 'Join the meeting before drawing on its whiteboard' };
    }

    await this.presence.addStroke(ctx.organizationId, data.roomKey, data.stroke).catch(() => {
      // A lost stroke is a cosmetic failure; don't refuse the draw over it.
      this.logger.warn(`Could not persist a whiteboard stroke for ${data.roomKey}`);
    });
    socket.to(room).emit('wb:stroke', { stroke: data.stroke, from: ctx.userId });
    return { ok: true };
  }

  @SubscribeMessage('wb:clear')
  async wbClear(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() data: { roomKey: string },
  ) {
    const ctx = this.require(socket);
    const room = meetRoom(ctx.organizationId, data.roomKey);
    if (!socket.rooms.has(room)) {
      return { ok: false, error: 'Join the meeting first' };
    }
    await this.presence.clearStrokes(ctx.organizationId, data.roomKey).catch(() => undefined);
    this.server.to(room).emit('wb:clear', { by: ctx.userId });
    return { ok: true };
  }

  /* ---------------------------------------------------------- upkeep */

  @SubscribeMessage('heartbeat')
  async heartbeat(@ConnectedSocket() socket: AuthedSocket) {
    const ctx = this.require(socket);
    await this.presence.touch(ctx.organizationId, socket.id);
    return { ok: true, at: Date.now() };
  }

  /* ------------------------------------------------- server-side push */

  /** Send a notification to one person, wherever they are connected. */
  async notifyUser(organizationId: string, userId: string, payload: unknown): Promise<void> {
    const entries = await this.presence.list(organizationId);
    for (const e of entries.filter((x) => x.userId === userId)) {
      this.server.to(e.socketId).emit('notification', payload);
    }
  }

  /** Announce something to a whole tenant. */
  broadcastToOrg(organizationId: string, event: string, payload: unknown): void {
    this.server.to(orgRoom(organizationId)).emit(event, payload);
  }

  /* -------------------------------------------------------- internals */

  private async broadcastPresence(organizationId: string): Promise<void> {
    const online = await this.presence.listUsers(organizationId);
    this.server.to(orgRoom(organizationId)).emit('presence', { online });
  }

  private require(socket: AuthedSocket): SocketContext {
    if (!socket.ctx) {
      // Should be unreachable: an unauthenticated socket is disconnected during
      // the handshake. Throwing rather than returning keeps handlers honest.
      throw new Error('Socket is not authenticated');
    }
    return socket.ctx;
  }

  /**
   * Run a handler inside the tenant context, and turn a thrown domain error
   * into an acknowledgement rather than an unhandled rejection — a socket
   * client has no HTTP status to read.
   */
  private async withContext<T>(
    socket: AuthedSocket,
    fn: () => Promise<T>,
  ): Promise<T | { ok: false; error: string; code?: string }> {
    const ctx = this.require(socket);
    try {
      return await runWithTenantContext(
        { ...ctx, roles: [], permissions: [], requestId: `ws:${socket.id}` },
        fn,
      );
    } catch (err) {
      const e = err as { code?: string; message?: string; response?: { message?: string } };
      return {
        ok: false,
        error: e?.response?.message ?? e?.message ?? 'That did not work',
        code: e?.code,
      };
    }
  }

  private reject(socket: Socket, reason: string): void {
    this.logger.warn(`Rejected socket ${socket.id}: ${reason}`);
    socket.emit('unauthorized', { message: reason });
    socket.disconnect(true);
  }
}

/** Token from the handshake auth payload, a query param, or a bearer header. */
function extractToken(socket: Socket): string | null {
  const auth = socket.handshake.auth as { token?: string } | undefined;
  if (auth?.token) return auth.token;

  const query = socket.handshake.query?.token;
  if (typeof query === 'string' && query) return query;

  const header = socket.handshake.headers?.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;

  return null;
}
