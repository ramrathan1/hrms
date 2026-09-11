import { Module } from '@nestjs/common';

import {
  ContractsController, DiscussionsController, RoadmapController,
} from './delivery.controller';
import { ContractsService, DiscussionsService, RoadmapService } from './delivery.service';

/** The paperwork and conversation around delivery, rather than the work itself. */
@Module({
  controllers: [ContractsController, DiscussionsController, RoadmapController],
  providers: [ContractsService, DiscussionsService, RoadmapService],
})
export class DeliveryModule {}
