import { Module } from '@nestjs/common';

import {
  AssetsController, EventsController, KbController, LettersController, NoticesController,
} from './workplace.controller';
import {
  AssetsService, EventsService, KbService, LettersService, NoticesService,
} from './workplace.service';

@Module({
  controllers: [AssetsController, EventsController, NoticesController, KbController, LettersController],
  providers: [AssetsService, EventsService, NoticesService, KbService, LettersService],
})
export class WorkplaceModule {}
