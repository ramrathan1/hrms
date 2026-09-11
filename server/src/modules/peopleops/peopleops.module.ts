import { Module } from '@nestjs/common';

import { AttendanceService } from './attendance.service';
import { LeaveService } from './leave.service';
import { HolidaysService, LeaveTypesService, ShiftsService } from './peopleops.service';
import {
  AttendanceController, HolidaysController, LeaveController, LeaveTypesController, ShiftsController,
} from './peopleops.controller';

@Module({
  controllers: [
    LeaveController, AttendanceController, LeaveTypesController, ShiftsController, HolidaysController,
  ],
  providers: [LeaveService, AttendanceService, LeaveTypesService, ShiftsService, HolidaysService],
  exports: [LeaveService, AttendanceService],
})
export class PeopleOpsModule {}
