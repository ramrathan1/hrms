import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, Max, Min, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum LeadStatusDto {
  NEW = 'NEW', CONTACTED = 'CONTACTED', QUALIFIED = 'QUALIFIED',
  PROPOSAL = 'PROPOSAL', CONVERTED = 'CONVERTED', LOST = 'LOST',
}

export enum StageOutcomeDto { OPEN = 'OPEN', WON = 'WON', LOST = 'LOST' }

export class CreateLeadDto {
  @ApiProperty() @IsString() @MinLength(1, { message: 'Enter the lead name' }) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() company?: string;
  @ApiPropertyOptional() @IsEmail({}, { message: 'Enter a valid email address' }) @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional({ example: 'Website' }) @IsString() @IsOptional() source?: string;
  @ApiPropertyOptional({ enum: LeadStatusDto }) @IsEnum(LeadStatusDto) @IsOptional() status?: LeadStatusDto;
  @ApiPropertyOptional() @IsUUID() @IsOptional() ownerId?: string;
  @ApiPropertyOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() value?: number;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}

export class LeadQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LeadStatusDto }) @IsEnum(LeadStatusDto) @IsOptional() status?: LeadStatusDto;
  @ApiPropertyOptional() @IsString() @IsOptional() source?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() ownerId?: string;
}

export class CreateLeadNoteDto {
  @ApiProperty() @IsString() @MinLength(1, { message: 'Write something first' }) body!: string;
}

export class ConvertLeadDto {
  @ApiPropertyOptional({ description: 'Defaults to the lead’s company' })
  @IsString() @IsOptional() company?: string;

  @ApiPropertyOptional({ description: 'Defaults to the lead’s name' })
  @IsString() @IsOptional() contactName?: string;

  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;

  @ApiPropertyOptional({ description: 'Also open a project for the new client' })
  @IsBoolean() @IsOptional() createProject?: boolean;

  @ApiPropertyOptional() @IsString() @IsOptional() projectName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() projectCode?: string;
  @ApiPropertyOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() projectBudget?: number;
}

export class CreateStageDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ example: 0 }) @IsInt() @Min(0) position!: number;
  @ApiPropertyOptional({ enum: StageOutcomeDto, default: StageOutcomeDto.OPEN })
  @IsEnum(StageOutcomeDto) @IsOptional() outcome?: StageOutcomeDto;
}

export class UpdateStageDto extends PartialType(CreateStageDto) {}

export class CreateDealDto {
  @ApiProperty() @IsString() @MinLength(1, { message: 'Give the deal a title' }) title!: string;
  @ApiProperty() @IsUUID() stageId!: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() leadId?: string;
  @ApiPropertyOptional({ default: 0 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() value?: number;
  @ApiPropertyOptional({ default: 'USD' }) @IsString() @IsOptional() currency?: string;
  @ApiPropertyOptional({ minimum: 0, maximum: 100 }) @IsInt() @Min(0) @Max(100) @IsOptional() probability?: number;
  @ApiPropertyOptional() @IsDateString() @IsOptional() expectedCloseOn?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() ownerId?: string;
}

export class UpdateDealDto extends PartialType(CreateDealDto) {}

export class MoveDealDto {
  @ApiProperty({ description: 'Landing on a WON or LOST stage closes the deal' })
  @IsUUID() stageId!: string;
}

export class DealQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() stageId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() ownerId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() leadId?: string;
  @ApiPropertyOptional({ description: 'true to exclude closed deals' }) @IsString() @IsOptional() open?: string;
}

/** Filters for the flat lead-note list. */
export class LeadNoteQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() leadId?: string;
}
