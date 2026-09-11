import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum ApprovalStatusDto { PENDING = 'PENDING', APPROVED = 'APPROVED', REJECTED = 'REJECTED' }

export class CreateExpenseDto {
  @ApiProperty() @IsString() @MinLength(1, { message: 'What was the expense for?' }) item!: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @ApiProperty({ example: '2026-09-01' }) @IsDateString() spentOn!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() projectId?: string;
  @ApiPropertyOptional({ default: 'USD' }) @IsString() @IsOptional() currency?: string;
}
export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

export class DecideExpenseDto {
  @ApiProperty({ enum: [ApprovalStatusDto.APPROVED, ApprovalStatusDto.REJECTED] })
  @IsEnum(ApprovalStatusDto) decision!: ApprovalStatusDto.APPROVED | ApprovalStatusDto.REJECTED;
}

export class ExpenseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ApprovalStatusDto }) @IsEnum(ApprovalStatusDto) @IsOptional() status?: ApprovalStatusDto;
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() projectId?: string;
}

export class PaymentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() invoiceId?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() from?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() to?: string;
}

export class EstimateQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
}
