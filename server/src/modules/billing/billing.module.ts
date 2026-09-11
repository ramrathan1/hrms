import { Module } from '@nestjs/common';

import { InvoicesController, PaymentsController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import {
  EstimatesController, ExpensesController, PaymentsLedgerController,
} from './finance.controller';
import { EstimatesService, ExpensesService, PaymentsListService } from './finance.service';

@Module({
  controllers: [
    InvoicesController,
    PaymentsController,
    PaymentsLedgerController,
    ExpensesController,
    EstimatesController,
  ],
  providers: [InvoicesService, ExpensesService, EstimatesService, PaymentsListService],
  exports: [InvoicesService],
})
export class BillingModule {}
