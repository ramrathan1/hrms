import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';

/**
 * Socket.IO backed by Redis pub/sub.
 *
 * Without this, rooms are per-process: two API instances behind a load balancer
 * would each hold half the sockets, and a message emitted on one would never
 * reach the other. The adapter makes `server.to(room).emit()` mean the same
 * thing across every instance.
 *
 * It degrades rather than fails — if Redis is unreachable the gateway still
 * works for a single process, which is the right behaviour in development.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const config = this.app.get(ConfigService);
    const url = config.getOrThrow<string>('redis.url');

    try {
      const pubClient = new Redis(url, { maxRetriesPerRequest: 2 });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.ping(), subClient.ping()]);

      pubClient.on('error', (e) => this.logger.warn(`Socket.IO pub error: ${e.message}`));
      subClient.on('error', (e) => this.logger.warn(`Socket.IO sub error: ${e.message}`));

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Socket.IO clustering through Redis');
    } catch (err) {
      this.logger.warn(
        `Redis adapter unavailable (${(err as Error).message}) — sockets will be single-process only`,
      );
    }
  }

  override createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      (server as { adapter: (a: unknown) => void }).adapter(this.adapterConstructor);
    }
    return server;
  }
}
