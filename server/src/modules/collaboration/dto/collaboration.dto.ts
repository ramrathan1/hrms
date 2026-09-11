import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum ChannelKindDto {
  PUBLIC = 'PUBLIC', PRIVATE = 'PRIVATE', GROUP = 'GROUP', DIRECT = 'DIRECT',
}

export class CreateChannelDto {
  @ApiProperty({ example: 'delivery', description: 'Slugified server-side' })
  @IsString() @MinLength(1, { message: 'Give the channel a name' }) name!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;

  @ApiPropertyOptional({ enum: ChannelKindDto, default: ChannelKindDto.PUBLIC })
  @IsEnum(ChannelKindDto) @IsOptional() kind?: ChannelKindDto;

  @ApiPropertyOptional({ type: [String], description: 'The creator is always added' })
  @IsArray() @IsUUID('4', { each: true }) @IsOptional() memberIds?: string[];
}

export class UpdateChannelDto extends PartialType(CreateChannelDto) {}

export class CreateDirectChannelDto {
  @ApiProperty({ description: 'The other person. Reuses an existing DM if there is one.' })
  @IsUUID() userId!: string;
}

export class SetChannelMembersDto {
  @ApiProperty({ type: [String], description: 'Replaces the member list entirely' })
  @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true }) userIds!: string[];
}

export class ChannelQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ChannelKindDto }) @IsEnum(ChannelKindDto) @IsOptional() kind?: ChannelKindDto;
}

export class SendMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString() @MinLength(1, { message: 'Write something first' }) @MaxLength(4000) body!: string;

  @ApiPropertyOptional({ description: 'Reply inside a thread' })
  @IsUUID() @IsOptional() parentId?: string;
}

export class EditMessageDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString() @MinLength(1) @MaxLength(4000) body!: string;
}

export class ReactDto {
  @ApiProperty({ example: '👍', description: 'Toggles: reacting twice removes it' })
  @IsString() @MinLength(1) @MaxLength(8) emoji!: string;
}

export class MessageHistoryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Fetch a thread instead of the channel root' })
  @IsUUID() @IsOptional() parentId?: string;

  @ApiPropertyOptional({ description: 'Only messages older than this timestamp' })
  @IsDateString() @IsOptional() before?: string;
}
