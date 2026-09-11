import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum AssetStatusDto {
  AVAILABLE = 'AVAILABLE', ASSIGNED = 'ASSIGNED', IN_REPAIR = 'IN_REPAIR', RETIRED = 'RETIRED',
}

export class CreateAssetDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() assetCode?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() serialNumber?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() purchasedOn?: string;
  @ApiPropertyOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() cost?: number;
  @ApiPropertyOptional({ enum: AssetStatusDto }) @IsEnum(AssetStatusDto) @IsOptional() status?: AssetStatusDto;
}
export class UpdateAssetDto extends PartialType(CreateAssetDto) {}

export class AssignAssetDto {
  @ApiPropertyOptional({ description: 'Omit to return the asset to the pool' })
  @IsUUID() @IsOptional() toUserId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() note?: string;
}

export class AssetQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AssetStatusDto }) @IsEnum(AssetStatusDto) @IsOptional() status?: AssetStatusDto;
  @ApiPropertyOptional() @IsUUID() @IsOptional() assignedToId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
}

export class CreateEventDto {
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiProperty() @IsDateString() startsAt!: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endsAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() location?: string;
}
export class UpdateEventDto extends PartialType(CreateEventDto) {}

export class EventQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'true for events still ahead' }) @IsString() @IsOptional() upcoming?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() from?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() to?: string;
}

export class CreateNoticeDto {
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiProperty() @IsString() @MinLength(1) body!: string;
  @ApiPropertyOptional({ default: 'All' }) @IsString() @IsOptional() audience?: string;
  @ApiPropertyOptional({ description: 'Publish immediately rather than saving a draft' })
  @IsBoolean() @IsOptional() publish?: boolean;
}
export class UpdateNoticeDto extends PartialType(CreateNoticeDto) {}

export class NoticeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'true to exclude drafts' }) @IsString() @IsOptional() published?: string;
}

export class CreateKbArticleDto {
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiProperty() @IsString() @MinLength(1) body!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional({ default: 'Internal', description: 'Client-visible articles show in the portal' })
  @IsString() @IsOptional() visibility?: string;
}
export class UpdateKbArticleDto extends PartialType(CreateKbArticleDto) {}

export class KbQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() visibility?: string;
}

export class CreateTemplateDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ description: 'Supports {{employee_name}}, {{salary}}, {{today}} and others' })
  @IsString() @MinLength(1) body!: string;
}
export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}

export class PreviewLetterDto {
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiPropertyOptional({ description: 'Required unless body is supplied' }) @IsUUID() @IsOptional() templateId?: string;
  @ApiPropertyOptional({ description: 'Overrides the template body' }) @IsString() @IsOptional() body?: string;
}

export class GenerateLetterDto extends PreviewLetterDto {}
