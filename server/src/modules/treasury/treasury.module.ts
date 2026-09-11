import { Module } from '@nestjs/common';

import {
  BankAccountsController, CreditNotesController, RecurringExpensesController,
  RecurringInvoicesController, TransactionsController,
} from './treasury.controller';
import {
  BankAccountsService, CreditNotesService, RecurringExpensesService,
  RecurringInvoicesService, TransactionsService,
} from './treasury.service';

/** Where the money sits and what it does on a schedule. */
@Module({
  controllers: [
    BankAccountsController,
    TransactionsController,
    CreditNotesController,
    RecurringInvoicesController,
    RecurringExpensesController,
  ],
  providers: [
    BankAccountsService,
    TransactionsService,
    CreditNotesService,
    RecurringInvoicesService,
    RecurringExpensesService,
  ],
})
export class TreasuryModule {}
