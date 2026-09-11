import { Module } from '@nestjs/common';

import {
  FloorsController, OfficeRoomsController, RecordingsController, TeamMeetingsController,
} from './office.controller';
import {
  FloorsService, OfficeRoomsService, RecordingsService, TeamMeetingsService,
} from './office.service';
import { RealtimeModule } from '../realtime/realtime.module';

/**
 * The virtual office and the meetings held in it. Room occupancy comes from the
 * realtime presence store, which is why this module depends on it.
 */
@Module({
  imports: [RealtimeModule],
  controllers: [
    FloorsController,
    OfficeRoomsController,
    TeamMeetingsController,
    RecordingsController,
  ],
  providers: [FloorsService, OfficeRoomsService, TeamMeetingsService, RecordingsService],
})
export class OfficeModule {}
