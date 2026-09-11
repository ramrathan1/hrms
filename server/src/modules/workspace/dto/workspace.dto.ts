import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum UserStatusDto { ACTIVE = 'ACTIVE', INVITED = 'INVITED', SUSPENDED = 'SUSPENDED' }

export class CreateUserDto {
  @ApiProperty() @IsEmail({}, { message: 'That does not look like an email address' }) email!: string;
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiProperty({ minLength: 10, description: 'Initial password. The user should change it.' })
  @IsString() @MinLength(10, { message: 'Use at least 10 characters' }) password!: string;
  @ApiPropertyOptional({ type: [String], description: 'Role keys, e.g. ["HR"]' })
  @IsArray() @IsString({ each: true }) @IsOptional() roles?: string[];
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ enum: UserStatusDto }) @IsEnum(UserStatusDto) @IsOptional() status?: UserStatusDto;
}

export class UserQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserStatusDto }) @IsEnum(UserStatusDto) @IsOptional() status?: UserStatusDto;
  @ApiPropertyOptional() @IsString() @IsOptional() role?: string;
}

export class NotificationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only the ones not yet read' })
  @IsOptional() unreadOnly?: string | boolean;
}

export class CreateTodoDto {
  @ApiProperty() @IsString() @MinLength(1, { message: 'Give the task a title' }) title!: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dueOn?: string;
}

export class UpdateTodoDto {
  @ApiPropertyOptional() @IsString() @IsOptional() title?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() done?: boolean;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dueOn?: string;
}

export class NotifyDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() body?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() kind?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() linkTo?: string;
}
