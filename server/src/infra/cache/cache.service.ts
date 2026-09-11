import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

import { getTenantContext } from '../tenant/tenant-context';

/**
 * Every key is namespaced by organization. Callers pass a logical key
 * ("dashboard:stats") and never see the tenant prefix, so it cannot be
 * forgotten.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private scoped(key: string): string {
    const org = getTenantContext()?.organizationId ?? 'global';
    return `ws:${org}:${key}`;
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      return (await this.cache.get<T>(this.scoped(key))) ?? undefined;
    } catch (err) {
      // A cache outage degrades performance; it must not break the request.
      this.logger.warn(`Cache read failed for ${key}: ${(err as Error).message}`);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      await this.cache.set(this.scoped(key), value, ttlSeconds ? ttlSeconds * 1000 : undefined);
    } catch (err) {
      this.logger.warn(`Cache write failed for ${key}: ${(err as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cache.del(this.scoped(key));
    } catch (err) {
      this.logger.warn(`Cache delete failed for ${key}: ${(err as Error).message}`);
    }
  }

  /** Read-through helper: compute and store on a miss. */
  async wrap<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
