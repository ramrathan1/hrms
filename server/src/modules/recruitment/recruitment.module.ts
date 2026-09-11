import { Module } from '@nestjs/common';

import {
  ApplicationsController, InterviewsController, JobsController, OffersController,
} from './recruitment.controller';
import {
  ApplicationsService, InterviewsService, JobsService, OffersService,
} from './recruitment.service';

@Module({
  controllers: [JobsController, ApplicationsController, InterviewsController, OffersController],
  providers: [JobsService, ApplicationsService, InterviewsService, OffersService],
  exports: [JobsService, OffersService],
})
export class RecruitmentModule {}
