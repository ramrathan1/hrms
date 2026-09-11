import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { BaseCrudService } from '../../common/services/base-crud.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CryptoService } from '../../infra/crypto/crypto.service';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { orgScope } from '../../infra/tenant/tenant-context';
import { paginate } from '../../common/dto/pagination.dto';
import type {
  CreateBioLinkDto, CreateDeviceDto, CreateDomainDto, CreateHostingDto, CreatePunchDto,
  CreateQrCodeDto, CreateWebhookDto, ExpiryQueryDto, PunchQueryDto, UpdateBioLinkDto,
  UpdateDeviceDto, UpdateDomainDto, UpdateHostingDto, UpdateQrCodeDto, UpdateWebhookDto,
} from './dto/it.dto';

type Row = { id: string };

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

@Injectable()
export class BioLinksService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'bioLink', ['name', 'slug'], ['name', 'clicks'], 'Bio link');
  }

  async createLink(dto: CreateBioLinkDto) {
    const slug = dto.slug?.trim() || slugify(dto.name);
    const clash = await this.prisma.db.bioLink.findFirst({ where: { slug }, select: { id: true } });
    if (clash) throw new ConflictError('SLUG_TAKEN', `Something already uses "${slug}"`);

    return this.create({
      ...orgScope(),
      name: dto.name,
      slug,
      links: (dto.links ?? []) as Prisma.InputJsonValue,
      status: dto.status ?? 'Active',
    });
  }

  updateLink(id: string, dto: UpdateBioLinkDto) {
    return this.update(id, {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.slug ? { slug: slugify(dto.slug) } : {}),
      ...(dto.links ? { links: dto.links as Prisma.InputJsonValue } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    });
  }
}

@Injectable()
export class QrCodesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'qrCode', ['title', 'payload'], ['createdAt', 'scans'], 'QR code');
  }

  createCode(dto: CreateQrCodeDto) {
    return this.create({
      ...orgScope(),
      title: dto.title,
      kind: dto.kind ?? 'URL',
      payload: dto.payload,
      color: dto.color ?? '#5b5ceb',
    });
  }

  updateCode(id: string, dto: UpdateQrCodeDto) {
    return this.update(id, {
      ...(dto.title ? { title: dto.title } : {}),
      ...(dto.kind ? { kind: dto.kind } : {}),
      ...(dto.payload ? { payload: dto.payload } : {}),
      ...(dto.color ? { color: dto.color } : {}),
    });
  }
}

/**
 * Outgoing webhooks.
 *
 * The signing secret is encrypted at rest and never leaves the server — a
 * secret a client can read back is not a secret. Callers see whether one is set
 * and nothing more.
 */
@Injectable()
export class WebhooksService extends BaseCrudService<Row> {
  constructor(
    prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {
    super(prisma, 'webhook', ['name', 'url'], ['name', 'createdAt'], 'Webhook');
  }

  private static readonly SAFE = {
    id: true, name: true, url: true, events: true, status: true,
    lastFiredAt: true, createdAt: true, updatedAt: true,
  } as const;

  override async findAll(query: Parameters<BaseCrudService<Row>['findAll']>[0]) {
    const where: Record<string, unknown> = {};
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { url: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.db.webhook.findMany({
        where,
        select: { ...WebhooksService.SAFE, secret: true },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.db.webhook.count({ where }),
    ]);

    const data = rows.map(({ secret, ...rest }) => ({ ...rest, hasSecret: Boolean(secret) }));
    return paginate<Row>(data as unknown as Row[], total, query.page, query.limit);
  }

  createWebhook(dto: CreateWebhookDto) {
    return this.create({
      ...orgScope(),
      name: dto.name,
      url: dto.url,
      events: dto.events ?? [],
      secret: dto.secret ? this.crypto.encrypt(dto.secret) : null,
      status: dto.status ?? 'Active',
    });
  }

  updateWebhook(id: string, dto: UpdateWebhookDto) {
    return this.update(id, {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.url ? { url: dto.url } : {}),
      ...(dto.events ? { events: dto.events } : {}),
      // An omitted secret leaves the existing one alone; an empty one clears it.
      ...(dto.secret !== undefined
        ? { secret: dto.secret ? this.crypto.encrypt(dto.secret) : null }
        : {}),
      ...(dto.status ? { status: dto.status } : {}),
    });
  }
}

@Injectable()
export class HostingsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'hosting', ['title', 'provider'], ['expiresOn', 'title'], 'Hosting');
  }

  protected override buildFilters(query: ExpiryQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    return where;
  }

  protected override listInclude() {
    return {
      client: { select: { id: true, name: true, company: true } },
      _count: { select: { domains: true } },
    };
  }

  createHosting(dto: CreateHostingDto) {
    return this.create({
      ...orgScope(),
      title: dto.title,
      provider: dto.provider ?? null,
      plan: dto.plan ?? null,
      clientId: dto.clientId ?? null,
      status: dto.status ?? 'Active',
      purchasedOn: dto.purchasedOn ? new Date(dto.purchasedOn) : null,
      expiresOn: dto.expiresOn ? new Date(dto.expiresOn) : null,
      cost: dto.cost != null ? new Prisma.Decimal(dto.cost) : null,
    });
  }

  updateHosting(id: string, dto: UpdateHostingDto) {
    return this.update(id, {
      ...(dto.title ? { title: dto.title } : {}),
      ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
      ...(dto.plan !== undefined ? { plan: dto.plan } : {}),
      ...(dto.clientId !== undefined ? { clientId: dto.clientId ?? null } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.purchasedOn ? { purchasedOn: new Date(dto.purchasedOn) } : {}),
      ...(dto.expiresOn ? { expiresOn: new Date(dto.expiresOn) } : {}),
      ...(dto.cost !== undefined ? { cost: new Prisma.Decimal(dto.cost) } : {}),
    });
  }
}

@Injectable()
export class DomainsService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'domain', ['name', 'provider'], ['expiresOn', 'name'], 'Domain');
  }

  protected override buildFilters(query: ExpiryQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    return where;
  }

  protected override listInclude() {
    return {
      client: { select: { id: true, name: true, company: true } },
      hosting: { select: { id: true, title: true } },
    };
  }

  createDomain(dto: CreateDomainDto) {
    return this.create({
      ...orgScope(),
      name: dto.name.toLowerCase(),
      provider: dto.provider ?? null,
      kind: dto.kind ?? null,
      clientId: dto.clientId ?? null,
      hostingId: dto.hostingId ?? null,
      status: dto.status ?? 'Active',
      purchasedOn: dto.purchasedOn ? new Date(dto.purchasedOn) : null,
      expiresOn: dto.expiresOn ? new Date(dto.expiresOn) : null,
    });
  }

  updateDomain(id: string, dto: UpdateDomainDto) {
    return this.update(id, {
      ...(dto.name ? { name: dto.name.toLowerCase() } : {}),
      ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
      ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
      ...(dto.clientId !== undefined ? { clientId: dto.clientId ?? null } : {}),
      ...(dto.hostingId !== undefined ? { hostingId: dto.hostingId ?? null } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.purchasedOn ? { purchasedOn: new Date(dto.purchasedOn) } : {}),
      ...(dto.expiresOn ? { expiresOn: new Date(dto.expiresOn) } : {}),
    });
  }

  /** Anything lapsing inside the window, soonest first. */
  async expiring(days = 60) {
    const until = new Date();
    until.setDate(until.getDate() + days);

    const [domains, hostings] = await Promise.all([
      this.prisma.db.domain.findMany({
        where: { expiresOn: { lte: until } },
        orderBy: { expiresOn: 'asc' },
        include: { client: { select: { id: true, company: true } } },
      }),
      this.prisma.db.hosting.findMany({
        where: { expiresOn: { lte: until } },
        orderBy: { expiresOn: 'asc' },
        include: { client: { select: { id: true, company: true } } },
      }),
    ]);
    return { withinDays: days, domains, hostings };
  }
}

@Injectable()
export class BiometricDevicesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'biometricDevice', ['name', 'serialNumber', 'location'], ['name'], 'Device');
  }

  protected override listInclude() {
    return { _count: { select: { punches: true } } };
  }

  async createDevice(dto: CreateDeviceDto) {
    const clash = await this.prisma.db.biometricDevice.findFirst({
      where: { serialNumber: dto.serialNumber },
      select: { id: true },
    });
    if (clash) throw new ConflictError('SERIAL_TAKEN', 'That serial number is already registered');

    return this.create({
      ...orgScope(),
      name: dto.name,
      serialNumber: dto.serialNumber,
      location: dto.location ?? null,
      status: dto.status ?? 'Offline',
    });
  }

  updateDevice(id: string, dto: UpdateDeviceDto) {
    return this.update(id, {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.serialNumber ? { serialNumber: dto.serialNumber } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    });
  }

  /** Record that a device checked in. The timestamp is the server's, not the caller's. */
  async sync(id: string) {
    const device = await this.prisma.db.biometricDevice.findFirst({ where: { id } });
    if (!device) throw new NotFoundError('Device', id);

    return this.prisma.db.biometricDevice.update({
      where: { id },
      data: { status: 'Online', lastSyncAt: new Date() },
    });
  }
}

/**
 * Raw device reads.
 *
 * These are evidence, not attendance: attendance records stay authoritative and
 * are corrected by a human. Keeping the two apart means a misconfigured reader
 * can't quietly rewrite someone's month.
 */
@Injectable()
export class BiometricPunchesService extends BaseCrudService<Row> {
  constructor(prisma: PrismaService) {
    super(prisma, 'biometricPunch', [], ['punchedAt'], 'Punch');
  }

  protected override buildFilters(query: PunchQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.deviceId) where.deviceId = query.deviceId;
    if (query.employeeId) where.employeeId = query.employeeId;
    return where;
  }

  protected override listInclude() {
    return {
      device: { select: { id: true, name: true } },
      employee: { select: { id: true, name: true, employeeCode: true } },
    };
  }

  async record(dto: CreatePunchDto) {
    const device = await this.prisma.db.biometricDevice.findFirst({
      where: { id: dto.deviceId },
      select: { id: true },
    });
    if (!device) throw new NotFoundError('Device', dto.deviceId);

    return this.create({
      ...orgScope(),
      deviceId: dto.deviceId,
      employeeId: dto.employeeId ?? null,
      direction: dto.direction,
      punchedAt: new Date(dto.punchedAt),
    });
  }
}
