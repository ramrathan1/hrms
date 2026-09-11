import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum ClientStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateClientDto {
  @ApiProperty({ example: 'Aleen Miller' })
  @IsString()
  @MinLength(1, { message: 'Enter the contact name' })
  name!: string;

  @ApiProperty({ example: 'Northwind' })
  @IsString()
  @MinLength(1, { message: 'Enter the company name' })
  company!: string;

  @ApiPropertyOptional()
  @IsEmail({}, { message: 'Enter a valid email address' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({ example: 'Enterprise' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  shippingAddress?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ enum: ClientStatusDto, default: ClientStatusDto.ACTIVE })
  @IsEnum(ClientStatusDto)
  @IsOptional()
  status?: ClientStatusDto;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {}

export class ClientQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ClientStatusDto })
  @IsEnum(ClientStatusDto)
  @IsOptional()
  status?: ClientStatusDto;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;
}

export class CreateContactDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsEmail({}, { message: 'Enter a valid email address' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Head of Delivery' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ description: 'Demotes any existing primary contact' })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}

export class ClientStatementQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsString()
  @IsOptional()
  to?: string;
}

export class AssignContactDto {
  @ApiProperty()
  @IsUUID()
  contactId!: string;
}

/** Filters for the flat contact list. */
export class ContactQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
}
