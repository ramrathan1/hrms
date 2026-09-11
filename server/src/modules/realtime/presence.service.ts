import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface PresenceEntry {
  userId: string;
  name: string;
  socketId: string;
  /** Virtual-office room, when the user has walked into one. */
  officeRoom: string | null;
  /** Meeting room key, when they are in a call. */
  meetRoom: string | null;
  since: number;
  /** Last time this socket proved it was alive. See `list()`. */
  lastSeen?: number;
}

/**
 * Who is online, kept in Redis rather than process memory.
 *
 * Memory would work for one instance and break silently the moment a second one
 * starts: each would report only the people it happens to hold. Redis keeps one
 * answer for the whole cluster.
 *
 * Keys are tenant-scoped — presence in one organization is invisible to another.
 */
@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private redis!: Redis;

  /** Entries expire on their own, so a hard crash cannot leave ghosts online. */
  private static readonly TTL_SECONDS = 90;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.redis = new Redis(this.config.getOrThrow<string>('redis.url'), {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    this.redis.on('error', (err) => {
      this.logger.warn(`Presence Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }

  private key(organizationId: string): string {
    return `ws:presence:${organizationId}`;
  }

  async join(organizationId: string, entry: PresenceEntry): Promise<void> {
    const key = this.key(organizationId);
    await this.redis.hset(key, entry.socketId, JSON.stringify({ ...entry, lastSeen: Date.now() }));
    await this.redis.expire(key, PresenceService.TTL_SECONDS);
  }

  async leave(organizationId: string, socketId: string): Promise<void> {
    await this.redis.hdel(this.key(organizationId), socketId);
  }

  /** Merge a partial update — used when someone moves room. */
  async update(
    organizationId: string,
    socketId: string,
    patch: Partial<PresenceEntry>,
  ): Promise<PresenceEntry | null> {
    const key = this.key(organizationId);
    const raw = await this.redis.hget(key, socketId);
    if (!raw) return null;

    const merged: PresenceEntry = {
      ...(JSON.parse(raw) as PresenceEntry),
      ...patch,
      lastSeen: Date.now(),
    };
    await this.redis.hset(key, socketId, JSON.stringify(merged));
    await this.redis.expire(key, PresenceService.TTL_SECONDS);
    return merged;
  }

  /**
   * Everyone currently connected in this tenant.
   *
   * The key's TTL is not enough on its own: every join and heartbeat resets it
   * for the whole hash, so one busy user keeps a crashed colleague's entry
   * alive indefinitely — and a server restart leaves every socket it was
   * holding stranded in the list. Each entry therefore carries its own
   * `lastSeen` and is dropped once it goes quiet, whatever the key's TTL says.
   */
  async list(organizationId: string): Promise<PresenceEntry[]> {
    const key = this.key(organizationId);
    const all = await this.redis.hgetall(key);
    const cutoff = Date.now() - PresenceService.TTL_SECONDS * 1000;

    const live: PresenceEntry[] = [];
    const stale: string[] = [];

    for (const [socketId, raw] of Object.entries(all)) {
      let entry: PresenceEntry | null = null;
      try {
        entry = JSON.parse(raw) as PresenceEntry;
      } catch {
        entry = null;
      }
      // Unparseable, or quiet for longer than the TTL: not online.
      if (!entry || (entry.lastSeen ?? entry.since ?? 0) < cutoff) stale.push(socketId);
      else live.push(entry);
    }

    if (stale.length) {
      // Sweep as we go, so the hash doesn't grow with every crashed process.
      await this.redis.hdel(key, ...stale).catch(() => undefined);
    }
    return live;
  }

  /**
   * Distinct people, not sockets. Two browser tabs are one person online, which
   * is what a presence list should show.
   */
  async listUsers(organizationId: string): Promise<
    Array<{ userId: string; name: string; officeRoom: string | null; meetRoom: string | null }>
  > {
    const entries = await this.list(organizationId);
    const byUser = new Map<string, PresenceEntry>();
    for (const e of entries) {
      const held = byUser.get(e.userId);
      // Prefer the connection that is actually somewhere.
      if (!held || (!held.officeRoom && e.officeRoom) || (!held.meetRoom && e.meetRoom)) {
        byUser.set(e.userId, e);
      }
    }
    return [...byUser.values()].map((e) => ({
      userId: e.userId,
      name: e.name,
      officeRoom: e.officeRoom,
      meetRoom: e.meetRoom,
    }));
  }

  /** Occupancy per office room, for the Virtual Office floor plan. */
  async officeOccupancy(organizationId: string): Promise<Record<string, string[]>> {
    const entries = await this.list(organizationId);
    const rooms: Record<string, string[]> = {};
    for (const e of entries) {
      if (!e.officeRoom) continue;
      const list = rooms[e.officeRoom] ?? [];
      if (!list.includes(e.userId)) list.push(e.userId);
      rooms[e.officeRoom] = list;
    }
    return rooms;
  }

  /** Everyone in one meeting room — the peer list a joiner needs. */
  async peersInMeeting(organizationId: string, roomKey: string): Promise<PresenceEntry[]> {
    const entries = await this.list(organizationId);
    return entries.filter((e) => e.meetRoom === roomKey);
  }

  /* ------------------------------------------------------- whiteboard */

  /**
   * Whiteboard strokes, kept per meeting room.
   *
   * Without this a late joiner sees a blank board while everyone else is
   * looking at a diagram. Capped and expiring, because a whiteboard is
   * scratch state — it should not outlive the meeting or grow without bound.
   */
  private static readonly WB_TTL_SECONDS = 60 * 60 * 4;
  private static readonly WB_MAX_STROKES = 5_000;

  private wbKey(organizationId: string, roomKey: string): string {
    return `ws:wb:${organizationId}:${roomKey}`;
  }

  async addStroke(organizationId: string, roomKey: string, stroke: unknown): Promise<void> {
    const key = this.wbKey(organizationId, roomKey);
    await this.redis.rpush(key, JSON.stringify(stroke));
    // Trim from the left so the most recent strokes survive.
    await this.redis.ltrim(key, -PresenceService.WB_MAX_STROKES, -1);
    await this.redis.expire(key, PresenceService.WB_TTL_SECONDS);
  }

  async strokes(organizationId: string, roomKey: string): Promise<unknown[]> {
    const raw = await this.redis.lrange(this.wbKey(organizationId, roomKey), 0, -1);
    return raw
      .map((s) => {
        try {
          return JSON.parse(s) as unknown;
        } catch {
          return null;
        }
      })
      .filter((s) => s !== null);
  }

  async clearStrokes(organizationId: string, roomKey: string): Promise<void> {
    await this.redis.del(this.wbKey(organizationId, roomKey));
  }

  /* ------------------------------------------------------ meeting chat */

  /**
   * The chat alongside a call.
   *
   * Kept in Redis with the whiteboard rather than in the database: it belongs
   * to the meeting, not to the org's permanent record, and a late joiner still
   * needs to see what has been said. Capped and expiring for the same reason
   * the whiteboard is.
   */
  private static readonly CHAT_MAX = 500;

  private chatKey(organizationId: string, roomKey: string): string {
    return `ws:meetchat:${organizationId}:${roomKey}`;
  }

  async addChatMessage(organizationId: string, roomKey: string, message: unknown): Promise<void> {
    const key = this.chatKey(organizationId, roomKey);
    await this.redis.rpush(key, JSON.stringify(message));
    await this.redis.ltrim(key, -PresenceService.CHAT_MAX, -1);
    await this.redis.expire(key, PresenceService.WB_TTL_SECONDS);
  }

  async chatHistory(organizationId: string, roomKey: string): Promise<unknown[]> {
    const raw = await this.redis.lrange(this.chatKey(organizationId, roomKey), 0, -1);
    return raw
      .map((line) => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return null;
        }
      })
      .filter((m) => m !== null);
  }

  /** Mark a connection alive. Called on the heartbeat. */
  async touch(organizationId: string, socketId: string): Promise<void> {
    // Stamps the entry as well as the key — `list()` reads the entry, so
    // refreshing only the key would let a live socket look stale.
    await this.update(organizationId, socketId, {});
  }
}
