import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsDateString, IsEmail, IsNumber, IsObject, IsOptional,
  IsString, IsUUID, Min, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateLeadFormDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiPropertyOptional({ description: 'URL slug; derived from the name when omitted' })
  @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional({ type: [Object], description: 'Field definitions from the form builder' })
  @IsArray() @IsOptional() fields?: unknown[];
  @ApiPropertyOptional() @IsBoolean() @IsOptional() active?: boolean;
}
export class UpdateLeadFormDto extends PartialType(CreateLeadFormDto) {}

export class CreateLeadEmailDto {
  @ApiProperty() @IsUUID() leadId!: string;
  @ApiProperty() @IsString() @MinLength(1) subject!: string;
  @ApiProperty() @IsEmail() toEmail!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() body?: string;
}

export class LeadEmailQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() leadId?: string;
}

export class CreateProposalDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() leadId?: string;
  @ApiPropertyOptional({ description: 'Generated when omitted' })
  @IsString() @IsOptional() number?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() title?: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) total!: number;
  @ApiPropertyOptional() @IsString() @IsOptional() currency?: string;
  @ApiPropertyOptional({ example: '2026-09-01' }) @IsDateString() @IsOptional() issuedOn?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() validUntil?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() note?: string;
}
export class UpdateProposalDto extends PartialType(CreateProposalDto) {}

export class ProposalQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() leadId?: string;
}

/** A public submission. Unauthenticated, so it is deliberately minimal. */
export class SubmitLeadFormDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() company?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional({ type: Object }) @IsObject() @IsOptional() answers?: Record<string, unknown>;
}
