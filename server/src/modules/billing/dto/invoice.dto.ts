import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString,
  IsUUID, Min, MinLength, ValidateNested,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum InvoiceStatusDto {
  DRAFT = 'DRAFT',
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export class InvoiceItemDto {
  @ApiProperty({ example: 'Discovery & UX audit' })
  @IsString()
  @MinLength(1, { message: 'Every line needs a description' })
  description!: string;

  @ApiProperty({ example: 1 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Quantity must be greater than zero' })
  quantity!: number;

  @ApiProperty({ example: 4200 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ example: 10, description: 'Percent' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  taxRate?: number;
}

export class CreateInvoiceDto {
  @ApiPropertyOptional({ description: 'Omit to let the server allocate the next number' })
  @IsString()
  @IsOptional()
  number?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiProperty({ example: '2026-08-29' })
  @IsDateString()
  issuedOn!: string;

  @ApiPropertyOptional({ example: '2026-09-28' })
  @IsDateString()
  @IsOptional()
  dueOn?: string;

  @ApiPropertyOptional({ default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ enum: InvoiceStatusDto })
  @IsEnum(InvoiceStatusDto)
  @IsOptional()
  status?: InvoiceStatusDto;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ type: [InvoiceItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'An invoice needs at least one line' })
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}

export class RecordPaymentDto {
  @ApiPropertyOptional({ description: 'Defaults to the full outstanding balance' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ example: '2026-08-29' })
  @IsDateString()
  @IsOptional()
  paidOn?: string;

  @ApiPropertyOptional({ example: 'Bank Transfer' })
  @IsString()
  @IsOptional()
  method?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  bankAccountId?: string;
}

export class RefundPaymentDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}

export class InvoiceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InvoiceStatusDto })
  @IsEnum(InvoiceStatusDto)
  @IsOptional()
  status?: InvoiceStatusDto;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Only invoices past their due date and unsettled' })
  @IsOptional()
  overdue?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  to?: string;
}
