import { BullModule } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { QUEUES } from './queue.constants';

/**
 * Bull queues on the same Redis as the cache.
 *
 * Everything registered here is work that must not run on the request path:
 * mail delivery, mailbox sync, recurring billing, exports and housekeeping.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.getOrThrow<string>('redis.url'));
        return {
          redis: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 200,
            removeOnFail: 500,
          },
        };
      },
    }),
    ...Object.values(QUEUES).map((name) => BullModule.registerQueue({ name })),
  ],
  exports: [BullModule],
})
export class AppQueueModule {}
