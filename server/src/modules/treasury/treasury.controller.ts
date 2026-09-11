import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import {
  BankAccountsService, CreditNotesService, RecurringExpensesService,
  RecurringInvoicesService, TransactionsService,
} from './treasury.service';
import {
  CreateBankAccountDto, CreateCreditNoteDto, CreateRecurringExpenseDto,
  CreateRecurringInvoiceDto, CreateTransactionDto, TransactionQueryDto,
  UpdateBankAccountDto, UpdateCreditNoteDto, UpdateRecurringExpenseDto,
  UpdateRecurringInvoiceDto,
} from './dto/treasury.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

class ApplyCreditDto {
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
}

@ApiTags('Bank accounts')
@ApiBearerAuth()
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly accounts: BankAccountsService) {}

  @Get()
  @RequirePermissions('payments:read')
  @ApiOperation({ summary: 'Accounts with balances computed from their ledgers' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.accounts.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('payments:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.findOne(id);
  }

  @Post()
  @RequirePermissions('payments:create')
  create(@Body() dto: CreateBankAccountDto) {
    return this.accounts.createAccount(dto);
  }

  @Patch(':id')
  @RequirePermissions('payments:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBankAccountDto) {
    return this.accounts.updateAccount(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('payments:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.remove(id);
  }
}

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @RequirePermissions('payments:read')
  findAll(@Query() query: TransactionQueryDto) {
    return this.transactions.findAll(query);
  }

  @Post()
  @RequirePermissions('payments:create')
  create(@Body() dto: CreateTransactionDto) {
    return this.transactions.record(dto);
  }

  @Delete(':id')
  @RequirePermissions('payments:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.transactions.remove(id);
  }
}

@ApiTags('Credit notes')
@ApiBearerAuth()
@Controller('credit-notes')
export class CreditNotesController {
  constructor(private readonly notes: CreditNotesService) {}

  @Get()
  @RequirePermissions('invoices:read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.notes.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('invoices:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.notes.findOne(id);
  }

  @Post()
  @RequirePermissions('invoices:create')
  create(@Body() dto: CreateCreditNoteDto) {
    return this.notes.createNote(dto);
  }

  @Patch(':id')
  @RequirePermissions('invoices:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCreditNoteDto) {
    return this.notes.updateNote(id, dto);
  }

  @Post(':id/apply')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('invoices:update')
  @ApiOperation({ summary: 'Use part of the credit; refuses to exceed what remains' })
  apply(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApplyCreditDto) {
    return this.notes.apply(id, dto.amount);
  }

  @Delete(':id')
  @RequirePermissions('invoices:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.notes.remove(id);
  }
}

@ApiTags('Recurring invoices')
@ApiBearerAuth()
@Controller('recurring-invoices')
export class RecurringInvoicesController {
  constructor(private readonly schedules: RecurringInvoicesService) {}

  @Get()
  @RequirePermissions('invoices:read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.schedules.findAll(query);
  }

  @Post()
  @RequirePermissions('invoices:create')
  create(@Body() dto: CreateRecurringInvoiceDto) {
    return this.schedules.createSchedule(dto);
  }

  @Patch(':id')
  @RequirePermissions('invoices:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRecurringInvoiceDto) {
    return this.schedules.updateSchedule(id, dto);
  }

  @Post(':id/run')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('invoices:create')
  @ApiOperation({ summary: 'Raise the next invoice now and move the schedule on' })
  run(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedules.runNow(id);
  }

  @Delete(':id')
  @RequirePermissions('invoices:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedules.remove(id);
  }
}

@ApiTags('Recurring expenses')
@ApiBearerAuth()
@Controller('recurring-expenses')
export class RecurringExpensesController {
  constructor(private readonly schedules: RecurringExpensesService) {}

  @Get()
  @RequirePermissions('expenses:read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.schedules.findAll(query);
  }

  @Post()
  @RequirePermissions('expenses:create')
  create(@Body() dto: CreateRecurringExpenseDto) {
    return this.schedules.createSchedule(dto);
  }

  @Patch(':id')
  @RequirePermissions('expenses:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRecurringExpenseDto) {
    return this.schedules.updateSchedule(id, dto);
  }

  @Post(':id/run')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('expenses:create')
  @ApiOperation({ summary: 'Book this cycle now and move the schedule on' })
  run(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedules.runNow(id);
  }

  @Delete(':id')
  @RequirePermissions('expenses:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedules.remove(id);
  }
}
