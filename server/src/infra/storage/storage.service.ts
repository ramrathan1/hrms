import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Blob storage for uploaded attachments, on the local filesystem.
 *
 * The database holds the metadata row and this holds the bytes; `storageKey` on
 * Attachment is the only thing tying them together. Keys are opaque to callers
 * and always built here — never derived from user input downstream — so the
 * layout below can change without touching FilesService.
 *
 * Keys are POSIX-style and org-prefixed:
 *
 *   <organizationId>/<yyyy>/<mm>/<uuid>-<slug>
 *
 * The org prefix keeps one tenant's blobs in one subtree, which is what makes a
 * per-tenant export or purge a directory operation rather than a table scan. The
 * UUID is what guarantees uniqueness — the slug is a human-readable tail, kept
 * only so the directory is browsable during development.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  /** Absolute, so every resolved path can be checked against it. */
  private readonly root: string;

  constructor(private readonly config: ConfigService) {
    this.root = path.resolve(this.config.get<string>('storage.root') ?? './storage');
  }

  /* ------------------------------------------------------------ keys */

  /**
   * Mint a key for a new blob. Never returns the same key twice, so an upload
   * can never overwrite an existing one.
   */
  buildKey(organizationId: string, fileName: string): string {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');

    return [
      this.segment(organizationId),
      year,
      month,
      `${randomUUID()}-${this.slug(fileName)}`,
    ].join('/');
  }

  /* --------------------------------------------------------- read/write */

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const info = await stat(this.resolve(key));
      return info.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Open the blob for reading. Synchronous by design: the caller hands the
   * stream straight to the HTTP response, and errors surface on the stream's
   * `error` event rather than as a rejected promise.
   */
  stream(key: string): ReadStream {
    return createReadStream(this.resolve(key));
  }

  async size(key: string): Promise<number> {
    const info = await stat(this.resolve(key));
    return info.size;
  }

  /**
   * Remove a blob. A key that is already gone is not an error — callers delete
   * defensively when a metadata write fails, and that path can run twice.
   */
  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  /* ----------------------------------------------------------- internals */

  /**
   * Map a key to an absolute path, refusing anything that would land outside
   * the storage root. Keys are minted by `buildKey`, but they make a round trip
   * through the database before coming back here, so this stays a hard check
   * rather than an assumption.
   */
  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    const prefix = this.root + path.sep;

    if (target !== this.root && !target.startsWith(prefix)) {
      this.logger.error(`Refusing storage key that escapes the root: ${key}`);
      throw new Error('Invalid storage key');
    }
    return target;
  }

  /** One path segment, stripped of anything with meaning to the filesystem. */
  private segment(value: string): string {
    const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '');
    return cleaned.length ? cleaned : 'unscoped';
  }

  /** A short, safe tail for the filename. The UUID carries the uniqueness. */
  private slug(fileName: string): string {
    const base = path.basename(fileName);
    const ext = path.extname(base).slice(0, 16).replace(/[^a-zA-Z0-9.]/g, '');
    const stem = base
      .slice(0, base.length - path.extname(base).length)
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .toLowerCase();

    return `${stem.length ? stem : 'file'}${ext}`;
  }
}
