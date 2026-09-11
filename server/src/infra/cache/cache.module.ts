import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';

import { CacheService } from './cache.service';

/**
 * Redis-backed cache.
 *
 * Keys are always tenant-prefixed by CacheService — a cache is the easiest
 * place to accidentally serve one tenant's data to another, so the prefix is
 * not optional and not the caller's job.
 */
@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [createKeyv(config.getOrThrow<string>('redis.url'))],
        ttl: config.get<number>('redis.ttlSeconds', 60) * 1000,
      }),
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class AppCacheModule {}
