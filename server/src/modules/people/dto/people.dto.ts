import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum DecisionDto { APPROVED = 'APPROVED', REJECTED = 'REJECTED' }

/* -------------------------------------------------------- compensation */

export class CreateSalaryDto {
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) annualAmount!: number;
  @ApiProperty({ example: '2026-01-01' }) @IsDateString() effectiveFrom!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() currency?: string;
  @ApiPropertyOptional({ description: 'Noted against the change for the history' })
  @IsString() @IsOptional() note?: string;
}

export class SalaryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
}

export class CreatePayslipDto {
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiProperty({ example: '2026-09-01' }) @IsDateString() periodStart!: string;
  @ApiProperty({ example: '2026-09-30' }) @IsDateString() periodEnd!: string;
  @ApiPropertyOptional({ description: 'Derived from the current salary when omitted' })
  @IsNumber({ maxDecimalPlaces: 2 }) @IsOptional() gross?: number;
  @ApiPropertyOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() deductions?: number;
}

export class PayslipQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}

export class CreateOvertimeDto {
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiProperty({ example: '2026-09-01' }) @IsDateString() workedOn!: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.5) @Max(24) hours!: number;
  @ApiPropertyOptional() @IsString() @IsOptional() reason?: string;
}
export class UpdateOvertimeDto extends PartialType(CreateOvertimeDto) {}

export class OvertimeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}

export class DecideDto {
  @ApiProperty({ enum: DecisionDto }) @IsEnum(DecisionDto) decision!: DecisionDto;
}

/* --------------------------------------------------------- performance */

export class CreateObjectiveDto {
  @ApiProperty() @IsString() @MinLength(3) title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional({ enum: ['Company', 'Team', 'Individual'] })
  @IsString() @IsOptional() kind?: string;
  @ApiPropertyOptional({ description: 'Employee who owns it' })
  @IsUUID() @IsOptional() employeeId?: string;
  @ApiPropertyOptional({ enum: ['High', 'Medium', 'Low'] }) @IsString() @IsOptional() priority?: string;
  @ApiPropertyOptional({ enum: ['Weekly', 'Monthly', 'Quarterly'] })
  @IsString() @IsOptional() checkinCadence?: string;
  @ApiProperty({ example: '2026-07-01' }) @IsDateString() periodStart!: string;
  @ApiProperty({ example: '2026-09-30' }) @IsDateString() periodEnd!: string;
}
export class UpdateObjectiveDto extends PartialType(CreateObjectiveDto) {}

export class CreateKeyResultDto {
  @ApiProperty() @IsUUID() objectiveId!: string;
  @ApiProperty() @IsString() @MinLength(2) title!: string;
  @ApiPropertyOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsOptional() target?: number;
  @ApiPropertyOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsOptional() current?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() unit?: string;
}
export class UpdateKeyResultDto extends PartialType(CreateKeyResultDto) {}

export class CreateReviewMeetingDto {
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiProperty({ example: '2026-09-15T10:00:00Z' }) @IsDateString() scheduledAt!: string;
  @ApiPropertyOptional() @IsInt() @Min(5) @Max(480) @IsOptional() durationMins?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() agenda?: string;
}
export class UpdateReviewMeetingDto extends PartialType(CreateReviewMeetingDto) {
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}

export class ReviewMeetingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}

export class CreateAwardDto {
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() icon?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() summary?: string;
}
export class UpdateAwardDto extends PartialType(CreateAwardDto) {}

export class CreateAppreciationDto {
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() awardId?: string;
  @ApiPropertyOptional({ example: '2026-09-01' }) @IsDateString() @IsOptional() awardedOn?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() note?: string;
}

export class AppreciationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
}

/* ------------------------------------------------------- employee file */

export class CreateEmergencyContactDto {
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiProperty() @IsString() @MinLength(2) name!: string;
  @ApiProperty() @IsString() @MinLength(4) phone!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() relation?: string;
}
export class UpdateEmergencyContactDto extends PartialType(CreateEmergencyContactDto) {}

export class CreateEmployeeDocumentDto {
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional({ description: 'Attachment id from the file upload' })
  @IsUUID() @IsOptional() fileId?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() issuedOn?: string;
}

export class EmployeeScopedQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
}
