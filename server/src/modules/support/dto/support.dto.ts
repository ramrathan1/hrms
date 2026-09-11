import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum TicketStatusDto {
  OPEN = 'OPEN', PENDING = 'PENDING', RESOLVED = 'RESOLVED', CLOSED = 'CLOSED',
}
export enum PriorityDto { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', URGENT = 'URGENT' }

export class CreateTicketDto {
  @ApiProperty() @IsString() @MinLength(1, { message: 'Describe the issue in the subject' }) subject!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() body?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() requesterName?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() assigneeId?: string;
  @ApiPropertyOptional({ enum: PriorityDto }) @IsEnum(PriorityDto) @IsOptional() priority?: PriorityDto;
  @ApiPropertyOptional({ example: 'Email' }) @IsString() @IsOptional() channel?: string;

  @ApiPropertyOptional({
    enum: TicketStatusDto,
    description: 'Defaults to OPEN. Set it when importing a ticket that is already under way.',
  })
  @IsEnum(TicketStatusDto) @IsOptional() status?: TicketStatusDto;
}

export class UpdateTicketDto extends PartialType(CreateTicketDto) {}

export class CreateReplyDto {
  @ApiProperty() @IsString() @MinLength(1, { message: 'Write a reply first' }) body!: string;
  @ApiPropertyOptional({ default: false, description: 'Internal notes never reach the client portal' })
  @IsBoolean() @IsOptional() isInternal?: boolean;
}

export class TicketQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TicketStatusDto }) @IsEnum(TicketStatusDto) @IsOptional() status?: TicketStatusDto;
  @ApiPropertyOptional({ enum: PriorityDto }) @IsEnum(PriorityDto) @IsOptional() priority?: PriorityDto;
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() assigneeId?: string;
  @ApiPropertyOptional({ description: 'true for OPEN or PENDING' }) @IsString() @IsOptional() open?: string;
}
