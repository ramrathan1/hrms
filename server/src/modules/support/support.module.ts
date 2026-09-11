import { Module } from '@nestjs/common';
import { TicketsController } from './support.controller';
import { TicketsService } from './support.service';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class SupportModule {}
