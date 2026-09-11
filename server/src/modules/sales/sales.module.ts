import { Module } from '@nestjs/common';

import {
  LeadEmailsController, LeadFormsController, ProposalsController,
} from './sales.controller';
import { LeadEmailsService, LeadFormsService, ProposalsService } from './sales.service';

/** The pre-sale trail: how an enquiry arrived, what was sent, what was offered. */
@Module({
  controllers: [LeadFormsController, LeadEmailsController, ProposalsController],
  providers: [LeadFormsService, LeadEmailsService, ProposalsService],
})
export class SalesModule {}
