import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { BusinessRuleError, NotFoundError } from '../../common/errors/domain.error';
import { getTenantContext, orgScope } from '../../infra/tenant/tenant-context';
import { paginate, type PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { FileQueryDto, UploadFileDto } from './dto/file.dto';

/** 25 MB, matching what the UI offered. */
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Types that execute in a browser. An SVG is the one people forget: it is an
 * image by extension and a script host in practice, which is exactly how the
 * old frontend upload became a stored-XSS vector on the app's own origin.
 */
const ACTIVE_CONTENT = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/xml',
  'text/xml',
  'application/javascript',
  'text/javascript',
  'application/x-httpd-php',
  'application/x-sh',
]);

/** Executables, refused outright rather than served with a safe header. */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.com', '.msi', '.scr',
  '.sh', '.bash', '.ps1', '.jar', '.app', '.deb', '.rpm',
]);

/** Magic-number prefixes, to catch a payload wearing the wrong Content-Type. */
const SIGNATURES: { mime: string; bytes: number[] }[] = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
];

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /* ----------------------------------------------------------- upload */

  async upload(file: UploadedFile, dto: UploadFileDto) {
    if (!file?.buffer?.length) {
      throw new BusinessRuleError('EMPTY_FILE', 'The uploaded file is empty');
    }
    if (file.size > MAX_BYTES) {
      throw new BusinessRuleError(
        'FILE_TOO_LARGE',
        `Files must be ${MAX_BYTES / 1024 / 1024} MB or smaller`,
      );
    }

    const name = file.originalname || 'upload';
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new BusinessRuleError(
        'FILE_TYPE_BLOCKED',
        `${ext} files cannot be uploaded`,
      );
    }

    // Trust the bytes over the declared type where we can recognise them.
    const detected = detectMime(file.buffer);
    const mimeType = detected ?? file.mimetype ?? 'application/octet-stream';
    if (detected && file.mimetype && detected !== file.mimetype) {
      this.logger.warn(
        `Upload "${name}" declared ${file.mimetype} but looks like ${detected}; storing as ${detected}`,
      );
    }

    const ctx = getTenantContext();
    const storageKey = this.storage.buildKey(ctx!.organizationId, name);
    await this.storage.put(storageKey, file.buffer);

    try {
      return await this.prisma.db.attachment.create({
        data: {
          ...orgScope(),
          ownerType: dto.ownerType,
          ownerId: dto.ownerId ?? null,
          fileName: name.slice(0, 255),
          mimeType,
          sizeBytes: file.size,
          storageKey,
          uploadedById: ctx?.userId ?? null,
        },
      });
    } catch (err) {
      // Don't leave an orphaned blob if the row fails to write.
      await this.storage.delete(storageKey).catch(() => undefined);
      throw err;
    }
  }

  /* ------------------------------------------------------------- read */

  async findAll(query: FileQueryDto & PaginationQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.ownerType) where.ownerType = query.ownerType;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.q) where.fileName = { contains: query.q, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.db.attachment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.db.attachment.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const found = await this.prisma.db.attachment.findFirst({ where: { id } });
    if (!found) throw new NotFoundError('File', id);
    return found;
  }

  /**
   * Everything a download response needs.
   *
   * `forceDownload` is true for anything that could execute in a browser. The
   * controller turns that into `Content-Disposition: attachment`, which is what
   * actually stops an uploaded SVG running as script on our origin.
   */
  async prepareDownload(id: string) {
    const record = await this.findOne(id);

    if (!(await this.storage.exists(record.storageKey))) {
      throw new NotFoundError('File contents', record.fileName);
    }

    return {
      record,
      stream: this.storage.stream(record.storageKey),
      forceDownload: ACTIVE_CONTENT.has(record.mimeType),
    };
  }

  /* ----------------------------------------------------------- delete */

  async remove(id: string) {
    const record = await this.findOne(id);
    await this.prisma.db.attachment.delete({ where: { id } });
    // Blob last: a failed unlink leaves a harmless orphan, whereas deleting the
    // blob first and then failing the row would leave a broken record.
    await this.storage.delete(record.storageKey).catch((err) => {
      this.logger.error(`Deleted attachment ${id} but its blob remains: ${(err as Error).message}`);
    });
    return { id, deleted: true as const };
  }

  /** Storage totals for the settings pane. */
  async usage() {
    const [agg, byType] = await Promise.all([
      this.prisma.db.attachment.aggregate({ _sum: { sizeBytes: true }, _count: true }),
      this.prisma.db.attachment.groupBy({
        by: ['mimeType'],
        _sum: { sizeBytes: true },
        _count: { _all: true },
      }),
    ]);

    const bytes = agg._sum.sizeBytes ?? 0;
    return {
      files: agg._count,
      bytes,
      megabytes: Number((bytes / 1024 / 1024).toFixed(2)),
      byType: byType
        .map((t) => ({
          group: t.mimeType.split('/')[0],
          mimeType: t.mimeType,
          files: t._count._all,
          bytes: t._sum.sizeBytes ?? 0,
        }))
        .sort((a, b) => b.bytes - a.bytes),
    };
  }
}

/** Returns a MIME type when the leading bytes are recognisable. */
function detectMime(buffer: Buffer): string | null {
  for (const sig of SIGNATURES) {
    if (sig.bytes.every((byte, i) => buffer[i] === byte)) return sig.mime;
  }
  return null;
}
