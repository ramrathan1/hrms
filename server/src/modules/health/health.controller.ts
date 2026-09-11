import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CacheService } from '../../infra/cache/cache.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness plus dependency checks' })
  async check() {
    const [db, redis] = await Promise.all([
      this.prisma.ping().then(() => 'up').catch((e: Error) => `down: ${e.message}`),
      this.cache
        .set('health:ping', '1', 5)
        .then(() => 'up')
        .catch((e: Error) => `down: ${e.message}`),
    ]);

    const ok = db === 'up' && redis === 'up';
    return {
      status: ok ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      dependencies: { postgres: db, redis },
      timestamp: new Date().toISOString(),
    };
  }
}
