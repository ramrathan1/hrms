import { Module } from '@nestjs/common';

import { CollaborationController, MessagesController } from './collaboration.controller';
import { CollaborationService } from './collaboration.service';

@Module({
  controllers: [CollaborationController, MessagesController],
  providers: [CollaborationService],
  exports: [CollaborationService],
})
export class CollaborationModule {}
