import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Global: the tenant-guarded client is needed by every domain module. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
