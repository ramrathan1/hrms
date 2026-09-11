import { Injectable } from '@nestjs/common';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { orgScope, requireTenantContext } from '../../infra/tenant/tenant-context';
import { PresenceService } from '../realtime/presence.service';
import type {
  CreateFloorDto, CreateRecordingDto, CreateRoomDto, CreateTeamMeetingDto,
  RecordingQueryDto, TeamMeetingQueryDto, UpdateFloorDto, UpdateRoomDto,
  UpdateTeamMeetingDto,
} from './dto/office.dto';

type Row = { id: string };

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

@Injectable()
export class FloorsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'floor', ['name'], ['position', 'name'], 'Floor');
  }

  protected override listInclude() {
    return { rooms: { orderBy: { position: 'asc' as const } } };
  }

  createFloor(dto: CreateFloorDto) {
    return this.create({ ...orgScope(), name: dto.name, position: dto.position ?? 0 });
  }

  updateFloor(id: string, dto: UpdateFloorDto) {
    return this.update(id, {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.position !== undefined ? { position: dto.position } : {}),
    });
  }

  /** A floor with rooms on it still has people in those rooms. */
  override async remove(id: string) {
    const rooms = await this.prisma.db.officeRoom.count({ where: { floorId: id } });
    if (rooms > 0) {
      throw new ConflictError('FLOOR_IN_USE', `${rooms} room(s) are on this floor. Move them first.`);
    }
    return super.remove(id);
  }
}

/**
 * Rooms on the virtual office floor plan.
 *
 * Occupancy is not stored: it comes from live presence, which is the only thing
 * that can know who is actually standing in a room right now.
 */
@Injectable()
export class OfficeRoomsService extends BaseCrudService<Row> {
  constructor(
    prisma: PrismaService,
    private readonly presence: PresenceService,
  ) {
    super(prisma, 'officeRoom', ['name', 'slug'], ['position', 'name'], 'Room');
  }

  protected override listInclude() {
    return { floor: { select: { id: true, name: true } } };
  }

  /** Rooms with who is in them right now. */
  async withOccupancy() {
    const ctx = requireTenantContext();
    const [rooms, occupancy] = await Promise.all([
      this.prisma.db.officeRoom.findMany({
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        include: { floor: { select: { id: true, name: true } } },
      }),
      this.presence.officeOccupancy(ctx.organizationId).catch(() => ({}) as Record<string, string[]>),
    ]);

    return rooms.map((room) => ({
      ...room,
      // Presence keys rooms by the same slug the client sends on office:move.
      occupants: occupancy[room.slug] ?? [],
    }));
  }

  async createRoom(dto: CreateRoomDto) {
    const floor = await this.prisma.db.floor.findFirst({
      where: { id: dto.floorId },
      select: { id: true },
    });
    if (!floor) throw new NotFoundError('Floor', dto.floorId);

    const slug = dto.slug?.trim() || slugify(dto.name);
    const clash = await this.prisma.db.officeRoom.findFirst({ where: { slug }, select: { id: true } });
    if (clash) throw new ConflictError('SLUG_TAKEN', `A room already uses "${slug}"`);

    return this.create({
      ...orgScope(),
      floorId: dto.floorId,
      name: dto.name,
      slug,
      kind: dto.kind ?? 'work',
      icon: dto.icon ?? '💼',
      capacity: dto.capacity ?? 8,
      position: dto.position ?? 0,
    });
  }

  updateRoom(id: string, dto: UpdateRoomDto) {
    return this.update(id, {
      ...(dto.floorId ? { floorId: dto.floorId } : {}),
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.slug ? { slug: slugify(dto.slug) } : {}),
      ...(dto.kind ? { kind: dto.kind } : {}),
      ...(dto.icon ? { icon: dto.icon } : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      ...(dto.position !== undefined ? { position: dto.position } : {}),
    });
  }
}

/**
 * Scheduled video meetings.
 *
 * The room key is issued here rather than by the client: it is what the realtime
 * gateway joins people to, and a client-chosen key could collide with — or
 * deliberately target — someone else's call.
 */
@Injectable()
export class TeamMeetingsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'teamMeeting', ['title', 'roomKey'], ['startsAt', 'title'], 'Meeting');
  }

  protected override buildFilters(query: TeamMeetingQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.upcoming === true || query.upcoming === 'true') {
      where.endedAt = null;
      where.startsAt = { gte: new Date() };
    }
    return where;
  }

  protected override listInclude() {
    return {
      project: { select: { id: true, name: true, code: true } },
      attendees: { select: { userId: true } },
      _count: { select: { recordings: true } },
    };
  }

  async schedule(dto: CreateTeamMeetingDto) {
    const ctx = requireTenantContext();
    const roomKey = `meet-${slugify(dto.title) || 'room'}-${Math.random().toString(36).slice(2, 7)}`;

    // The organiser is always in their own meeting.
    const attendeeIds = [...new Set([ctx.userId, ...(dto.attendeeIds ?? [])])];
    const known = await this.prisma.db.user.findMany({
      where: { id: { in: attendeeIds } },
      select: { id: true },
    });

    return this.create({
      ...orgScope(),
      title: dto.title,
      roomKey,
      projectId: dto.projectId ?? null,
      organizerId: ctx.userId,
      startsAt: new Date(dto.startsAt),
      durationMins: dto.durationMins ?? 30,
      attendees: { create: known.map((u) => ({ userId: u.id })) },
    });
  }

  async updateMeeting(id: string, dto: UpdateTeamMeetingDto) {
    if (dto.attendeeIds) {
      const known = await this.prisma.db.user.findMany({
        where: { id: { in: dto.attendeeIds } },
        select: { id: true },
      });
      await this.prisma.db.teamMeetingAttendee.deleteMany({ where: { meetingId: id } });
      await this.prisma.db.teamMeetingAttendee.createMany({
        data: known.map((u) => ({ meetingId: id, userId: u.id })),
        skipDuplicates: true,
      });
    }

    return this.update(id, {
      ...(dto.title ? { title: dto.title } : {}),
      ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
      ...(dto.durationMins !== undefined ? { durationMins: dto.durationMins } : {}),
      ...(dto.projectId !== undefined ? { projectId: dto.projectId ?? null } : {}),
    });
  }

  /** Close a meeting out. Idempotent — ending it twice is not an error. */
  async end(id: string) {
    const meeting = await this.prisma.db.teamMeeting.findFirst({ where: { id } });
    if (!meeting) throw new NotFoundError('Meeting', id);
    if (meeting.endedAt) return meeting;

    return this.prisma.db.teamMeeting.update({ where: { id }, data: { endedAt: new Date() } });
  }
}

@Injectable()
export class RecordingsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'recording', ['title', 'roomKey'], ['createdAt'], 'Recording');
  }

  protected override buildFilters(query: RecordingQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.meetingId) where.meetingId = query.meetingId;
    if (query.roomKey) where.roomKey = query.roomKey;
    return where;
  }

  protected override listInclude() {
    return { meeting: { select: { id: true, title: true } } };
  }

  /**
   * Register a recording against an already-uploaded file.
   *
   * The storage key is copied from the attachment rather than taken from the
   * caller, so a recording can only ever point at a file this tenant uploaded.
   */
  async register(dto: CreateRecordingDto) {
    const ctx = requireTenantContext();
    const file = await this.prisma.db.attachment.findFirst({ where: { id: dto.fileId } });
    if (!file) throw new NotFoundError('File', dto.fileId);

    if (dto.meetingId) {
      const meeting = await this.prisma.db.teamMeeting.findFirst({
        where: { id: dto.meetingId },
        select: { id: true },
      });
      if (!meeting) throw new NotFoundError('Meeting', dto.meetingId);
    }

    return this.create({
      ...orgScope(),
      meetingId: dto.meetingId ?? null,
      title: dto.title,
      roomKey: dto.roomKey,
      storageKey: file.storageKey,
      sizeBytes: file.sizeBytes,
      durationSecs: dto.durationSecs ?? 0,
      recordedById: ctx.userId,
    });
  }
}
