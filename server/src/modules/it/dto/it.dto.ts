import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUrl, IsUUID, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateBioLinkDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional({ type: [Object], description: '[{ label, url }]' })
  @IsArray() @IsOptional() links?: unknown[];
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}
export class UpdateBioLinkDto extends PartialType(CreateBioLinkDto) {}

export class CreateQrCodeDto {
  @ApiProperty() @IsString() @MinLength(2) title!: string;
  @ApiProperty({ description: 'What the code encodes' }) @IsString() payload!: string;
  @ApiPropertyOptional({ enum: ['URL', 'WiFi', 'WhatsApp', 'vCard', 'Text'] })
  @IsString() @IsOptional() kind?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() color?: string;
}
export class UpdateQrCodeDto extends PartialType(CreateQrCodeDto) {}

export class CreateWebhookDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiProperty({ example: 'https://example.com/hooks/worksuite' })
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Must be an https URL' })
  url!: string;
  @ApiPropertyOptional({ type: [String], example: ['invoice.paid'] })
  @IsArray() @IsString({ each: true }) @IsOptional() events?: string[];
  @ApiPropertyOptional({ description: 'Signing secret; stored encrypted and never returned' })
  @IsString() @IsOptional() secret?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}
export class UpdateWebhookDto extends PartialType(CreateWebhookDto) {}

export class CreateHostingDto {
  @ApiProperty() @IsString() @MinLength(2) title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() provider?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() plan?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() purchasedOn?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() expiresOn?: string;
  @ApiPropertyOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsOptional() cost?: number;
}
export class UpdateHostingDto extends PartialType(CreateHostingDto) {}

export class CreateDomainDto {
  @ApiProperty({ example: 'example.com' }) @IsString() @MinLength(3) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() provider?: string;
  @ApiPropertyOptional({ description: 'PROD, DEV, staging …' }) @IsString() @IsOptional() kind?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() hostingId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() purchasedOn?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() expiresOn?: string;
}
export class UpdateDomainDto extends PartialType(CreateDomainDto) {}

export class CreateDeviceDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiProperty() @IsString() @MinLength(2) serialNumber!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() location?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}
export class UpdateDeviceDto extends PartialType(CreateDeviceDto) {}

export class CreatePunchDto {
  @ApiProperty() @IsUUID() deviceId!: string;
  @ApiProperty({ enum: ['IN', 'OUT'] }) @IsIn(['IN', 'OUT']) direction!: 'IN' | 'OUT';
  @ApiProperty({ example: '2026-09-10T09:02:00Z' }) @IsDateString() punchedAt!: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
}

export class PunchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() deviceId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
}

export class ExpiryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
}
