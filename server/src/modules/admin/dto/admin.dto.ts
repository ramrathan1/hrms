import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class SaveSettingDto {
  @ApiProperty({
    type: 'object', additionalProperties: true,
    description: 'Merged into the existing values, never replacing them',
  })
  @IsObject() value!: Record<string, unknown>;
}

export class SetRolePermissionsDto {
  @ApiProperty({
    type: [String], example: ['invoices:read', 'invoices:create'],
    description: 'Replaces the role’s permissions. Any write implies read.',
  })
  @IsArray() @IsString({ each: true }) permissionKeys!: string[];
}

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'Invoice' }) @IsString() @IsOptional() entity?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() entityId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() actorId?: string;
  @ApiPropertyOptional({ example: 'UPDATE' }) @IsString() @IsOptional() action?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() from?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() to?: string;
}

export class SearchQueryDto {
  @ApiProperty({ example: 'northwind' }) @IsString() q!: string;
}
