import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { EstimatesService, ExpensesService, PaymentsListService } from './finance.service';
import {
  CreateExpenseDto, DecideExpenseDto, EstimateQueryDto, ExpenseQueryDto,
  PaymentQueryDto, UpdateExpenseDto,
} from './dto/finance.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @RequirePermissions('expenses:read')
  findAll(@Query() query: ExpenseQueryDto) {
    return this.expenses.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('expenses:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.expenses.findOne(id);
  }

  @Post()
  @RequirePermissions('expenses:create')
  create(@Body() dto: CreateExpenseDto) {
    return this.expenses.createExpense(dto);
  }

  @Patch(':id')
  @RequirePermissions('expenses:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExpenseDto) {
    return this.expenses.update(id, {
      ...dto,
      ...(dto.spentOn ? { spentOn: new Date(dto.spentOn) } : {}),
    });
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('expenses:approve')
  @ApiOperation({ summary: 'Approve or reject a claim. You cannot decide your own.' })
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideExpenseDto) {
    return this.expenses.decide(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('expenses:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.expenses.remove(id);
  }
}

@ApiTags('Estimates')
@ApiBearerAuth()
@Controller('estimates')
export class EstimatesController {
  constructor(private readonly estimates: EstimatesService) {}

  @Get()
  @RequirePermissions('estimates:read')
  findAll(@Query() query: EstimateQueryDto) {
    return this.estimates.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('estimates:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.estimates.findOne(id);
  }

  @Post()
  @RequirePermissions('estimates:create')
  create(@Body() body: Record<string, any>) {
    return this.estimates.create({
      ...body,
      issuedOn: new Date(body.issuedOn ?? Date.now()),
      ...(body.validUntil ? { validUntil: new Date(body.validUntil) } : {}),
    });
  }

  @Patch(':id')
  @RequirePermissions('estimates:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, any>) {
    return this.estimates.update(id, body);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('invoices:create')
  @ApiOperation({ summary: 'Raise an invoice from an accepted estimate' })
  convert(@Param('id', ParseUUIDPipe) id: string) {
    return this.estimates.convertToInvoice(id);
  }

  @Delete(':id')
  @RequirePermissions('estimates:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.estimates.remove(id);
  }
}

/** Read side of the payment ledger. Writes live on the invoice. */
@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsLedgerController {
  constructor(private readonly payments: PaymentsListService) {}

  @Get()
  @RequirePermissions('payments:read')
  findAll(@Query() query: PaymentQueryDto) {
    return this.payments.findAll(query);
  }
}
