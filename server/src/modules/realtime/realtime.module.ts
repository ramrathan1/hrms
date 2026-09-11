import { Module } from '@nestjs/common';

import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';
import { CollaborationModule } from '../collaboration/collaboration.module';

/**
 * The gateway needs CollaborationService for the membership check, so the
 * dependency points that way — collaboration knows nothing about sockets.
 */
@Module({
  imports: [CollaborationModule],
  providers: [RealtimeGateway, PresenceService],
  exports: [RealtimeGateway, PresenceService],
})
export class RealtimeModule {}
