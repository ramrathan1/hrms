import { Module } from '@nestjs/common';

import {
  DealsController, LeadNotesController, LeadsController, PipelineStagesController,
} from './crm.controller';
import {
  DealsService, LeadNotesService, LeadsService, PipelineStagesService,
} from './crm.service';

@Module({
  controllers: [LeadsController, DealsController, PipelineStagesController, LeadNotesController],
  providers: [LeadsService, DealsService, PipelineStagesService, LeadNotesService],
  exports: [LeadsService, DealsService],
})
export class CrmModule {}
