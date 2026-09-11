import { Module } from '@nestjs/common';

import {
  AppreciationsController, AwardsController, EmergencyContactsController,
  EmployeeDocumentsController, KeyResultsController, ObjectivesController,
  OvertimeController, PayslipsController, ReviewMeetingsController, SalariesController,
} from './people.controller';
import {
  AppreciationsService, AwardsService, EmergencyContactsService, EmployeeDocumentsService,
  KeyResultsService, ObjectivesService, OvertimeService, PayslipsService,
  ReviewMeetingsService, SalariesService, SalaryChangesService,
} from './people.service';

/**
 * What the company owes people and what it expects of them: pay, overtime,
 * objectives, one-to-ones, recognition, and the employee file itself.
 */
@Module({
  controllers: [
    SalariesController,
    PayslipsController,
    OvertimeController,
    ObjectivesController,
    KeyResultsController,
    ReviewMeetingsController,
    AwardsController,
    AppreciationsController,
    EmergencyContactsController,
    EmployeeDocumentsController,
  ],
  providers: [
    SalariesService,
    SalaryChangesService,
    PayslipsService,
    OvertimeService,
    ObjectivesService,
    KeyResultsService,
    ReviewMeetingsService,
    AwardsService,
    AppreciationsService,
    EmergencyContactsService,
    EmployeeDocumentsService,
  ],
})
export class PeopleModule {}
