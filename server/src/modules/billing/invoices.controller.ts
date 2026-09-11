import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto, InvoiceQueryDto, RecordPaymentDto, RefundPaymentDto, UpdateInvoiceDto,
} from './dto/invoice.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermissions('invoices:read')
  @ApiOperation({ summary: 'List invoices with filtering, search, sorting and pagination' })
  findAll(@Query() query: InvoiceQueryDto) {
    return this.invoices.findAll(query);
  }

  @Get('summary')
  @RequirePermissions('invoices:read')
  @ApiOperation({ summary: 'Billed / collected / outstanding totals (cached 60s)' })
  summary() {
    return this.invoices.summary();
  }

  @Get(':id')
  @RequirePermissions('invoices:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.findOne(id);
  }

  @Post()
  @RequirePermissions('invoices:create')
  @ApiOperation({ summary: 'Create an invoice; totals are computed from the line items' })
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoices.createInvoice(dto);
  }

  @Patch(':id')
  @RequirePermissions('invoices:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.updateInvoice(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('invoices:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.remove(id);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('payments:create')
  @ApiOperation({
    summary: 'Record a payment',
    description:
      'Inserts the payment and recomputes the invoice balance and status in one transaction. ' +
      'Rejects overpayment and payment against a settled or cancelled invoice.',
  })
  pay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordPaymentDto) {
    return this.invoices.recordPayment(id, dto);
  }
}

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post(':id/refund')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('payments:refund')
  @ApiOperation({ summary: 'Reverse a payment as a negative ledger row' })
  refund(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundPaymentDto) {
    return this.invoices.refundPayment(id, dto.reason);
  }
}
