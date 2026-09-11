import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export const CYCLES = ['Weekly', 'Monthly', 'Quarterly', 'Yearly'] as const;

export class CreateBankAccountDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() bankName?: string;
  @ApiPropertyOptional({ enum: ['Bank', 'Cash', 'Card'] })
  @IsString() @IsOptional() kind?: string;
  @ApiPropertyOptional({ description: 'Last four digits only — never the full number' })
  @IsString() @IsOptional() accountNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() currency?: string;
  @ApiPropertyOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsOptional() openingBalance?: number;
}
export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {}

export class CreateTransactionDto {
  @ApiProperty() @IsUUID() bankAccountId!: string;
  @ApiProperty({ enum: ['CREDIT', 'DEBIT'] }) @IsIn(['CREDIT', 'DEBIT']) direction!: 'CREDIT' | 'DEBIT';
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @ApiProperty({ example: '2026-09-01' }) @IsDateString() occurredOn!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() memo?: string;
}

export class TransactionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() bankAccountId?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() from?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() to?: string;
}

export class CreateCreditNoteDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() invoiceId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() number?: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) total!: number;
  @ApiPropertyOptional() @IsDateString() @IsOptional() issuedOn?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() reason?: string;
}
export class UpdateCreditNoteDto extends PartialType(CreateCreditNoteDto) {}

export class CreateRecurringInvoiceDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @ApiPropertyOptional({ enum: CYCLES }) @IsIn(CYCLES as unknown as string[]) @IsOptional() cycle?: string;
  @ApiProperty({ example: '2026-01-01' }) @IsDateString() startedOn!: string;
  @ApiPropertyOptional({ description: 'Defaults to one cycle after the start date' })
  @IsDateString() @IsOptional() nextRunOn?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() memo?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() currency?: string;
}
export class UpdateRecurringInvoiceDto extends PartialType(CreateRecurringInvoiceDto) {}

export class CreateRecurringExpenseDto {
  @ApiProperty() @IsString() @MinLength(1) item!: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @ApiPropertyOptional({ enum: CYCLES }) @IsIn(CYCLES as unknown as string[]) @IsOptional() cycle?: string;
  @ApiProperty({ example: '2026-09-01' }) @IsDateString() nextRunOn!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() currency?: string;
}
export class UpdateRecurringExpenseDto extends PartialType(CreateRecurringExpenseDto) {}
