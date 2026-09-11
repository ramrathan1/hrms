import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString,
  IsUUID, Max, Min, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum ApprovalStatusDto { PENDING = 'PENDING', APPROVED = 'APPROVED', REJECTED = 'REJECTED' }
export enum AttendanceStatusDto {
  PRESENT = 'PRESENT', ABSENT = 'ABSENT', LATE = 'LATE', HALF_DAY = 'HALF_DAY',
  ON_LEAVE = 'ON_LEAVE', HOLIDAY = 'HOLIDAY', WEEKEND = 'WEEKEND',
}

/* ------------------------------------------------------------------ leave */

export class CreateLeaveDto {
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiProperty() @IsUUID() leaveTypeId!: string;
  @ApiProperty({ example: '2026-09-14' }) @IsDateString() startsOn!: string;
  @ApiPropertyOptional({ description: 'Defaults to the start date' }) @IsDateString() @IsOptional() endsOn?: string;
  @ApiPropertyOptional({ description: 'Counts as 0.5 days; must be a single date' })
  @IsBoolean() @IsOptional() halfDay?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() reason?: string;
}
export class UpdateLeaveDto extends PartialType(CreateLeaveDto) {}

export class DecideLeaveDto {
  @ApiProperty({ enum: [ApprovalStatusDto.APPROVED, ApprovalStatusDto.REJECTED] })
  @IsEnum(ApprovalStatusDto) decision!: ApprovalStatusDto.APPROVED | ApprovalStatusDto.REJECTED;

  @ApiPropertyOptional() @IsString() @IsOptional() note?: string;
}

export class LeaveQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ApprovalStatusDto }) @IsEnum(ApprovalStatusDto) @IsOptional() status?: ApprovalStatusDto;
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() leaveTypeId?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() from?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() to?: string;
}

export class BalanceQueryDto {
  @ApiPropertyOptional({ description: 'Omit to get every employee\'s balances' })
  @IsUUID() @IsOptional() employeeId?: string;
  @ApiPropertyOptional({ example: 2026 }) @Type(() => Number) @IsInt() @IsOptional() year?: number;
}

export class CreateLeaveTypeDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional({ default: 0, description: 'Annual entitlement; overridable per employee' })
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) @IsOptional() defaultQuota?: number;
  @ApiPropertyOptional({ default: true }) @IsBoolean() @IsOptional() paid?: boolean;
}
export class UpdateLeaveTypeDto extends PartialType(CreateLeaveTypeDto) {}

/* ------------------------------------------------------------- attendance */

export class ClockDto {
  @ApiPropertyOptional({ description: 'Defaults to the signed-in user' })
  @IsUUID() @IsOptional() employeeId?: string;
  @ApiPropertyOptional({ description: 'Defaults to now' }) @IsDateString() @IsOptional() at?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() location?: string;
}

export class MarkAttendanceDto {
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiProperty({ example: '2026-09-10' }) @IsDateString() workDate!: string;
  @ApiProperty({ enum: AttendanceStatusDto }) @IsEnum(AttendanceStatusDto) status!: AttendanceStatusDto;
  @ApiPropertyOptional() @IsDateString() @IsOptional() clockInAt?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() clockOutAt?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() note?: string;
}

export class AttendanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
  @ApiPropertyOptional({ enum: AttendanceStatusDto }) @IsEnum(AttendanceStatusDto) @IsOptional() status?: AttendanceStatusDto;
  @ApiPropertyOptional() @IsDateString() @IsOptional() from?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() to?: string;
}

export class MonthlyGridQueryDto {
  @ApiProperty({ example: 2026 }) @Type(() => Number) @IsInt() @Min(2000) year!: number;
  @ApiProperty({ example: 9, minimum: 1, maximum: 12 })
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
  @ApiPropertyOptional() @IsUUID() @IsOptional() departmentId?: string;
}

/* ------------------------------------------------------ shifts & holidays */

export class CreateShiftDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ example: '09:00' }) @IsString() startsAt!: string;
  @ApiProperty({ example: '18:00' }) @IsString() endsAt!: string;
  @ApiPropertyOptional({ example: 'Mon-Fri' }) @IsString() @IsOptional() workingDays?: string;
}
export class UpdateShiftDto extends PartialType(CreateShiftDto) {}

export class CreateHolidayDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ example: '2026-12-25' }) @IsDateString() holidayOn!: string;
}
export class UpdateHolidayDto extends PartialType(CreateHolidayDto) {}
