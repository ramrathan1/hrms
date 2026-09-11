import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, Max, Min, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum JobStatusDto { DRAFT = 'DRAFT', OPEN = 'OPEN', CLOSED = 'CLOSED' }
export enum EmploymentTypeDto {
  FULL_TIME = 'FULL_TIME', PART_TIME = 'PART_TIME', CONTRACT = 'CONTRACT',
  INTERN = 'INTERN', TRAINEE = 'TRAINEE',
}
export enum ApplicationStageDto {
  APPLIED = 'APPLIED', PHONE_SCREEN = 'PHONE_SCREEN', INTERVIEW = 'INTERVIEW',
  OFFER = 'OFFER', HIRED = 'HIRED', REJECTED = 'REJECTED',
}
export enum InterviewStatusDto {
  SCHEDULED = 'SCHEDULED', COMPLETED = 'COMPLETED', CANCELLED = 'CANCELLED', NO_SHOW = 'NO_SHOW',
}
export enum OfferStatusDto {
  DRAFT = 'DRAFT', SENT = 'SENT', ACCEPTED = 'ACCEPTED', DECLINED = 'DECLINED', WITHDRAWN = 'WITHDRAWN',
}

export class CreateJobDto {
  @ApiProperty() @IsString() @MinLength(1, { message: 'Give the role a title' }) title!: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() departmentId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() location?: string;
  @ApiPropertyOptional({ enum: EmploymentTypeDto }) @IsEnum(EmploymentTypeDto) @IsOptional() employmentType?: EmploymentTypeDto;
  @ApiPropertyOptional({ default: 1, minimum: 1 }) @IsInt() @Min(1) @IsOptional() openings?: number;
  @ApiPropertyOptional({ enum: JobStatusDto }) @IsEnum(JobStatusDto) @IsOptional() status?: JobStatusDto;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() opensOn?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() closesOn?: string;
}
export class UpdateJobDto extends PartialType(CreateJobDto) {}

export class JobQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: JobStatusDto }) @IsEnum(JobStatusDto) @IsOptional() status?: JobStatusDto;
  @ApiPropertyOptional() @IsUUID() @IsOptional() departmentId?: string;
}

export class CreateApplicationDto {
  @ApiProperty() @IsUUID() jobId!: string;
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty() @IsEmail({}, { message: 'Enter a valid email address' }) email!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional({ type: [String] }) @IsArray() @IsString({ each: true }) @IsOptional() skills?: string[];
  @ApiPropertyOptional() @IsUUID() @IsOptional() resumeFileId?: string;
}
export class UpdateApplicationDto extends PartialType(CreateApplicationDto) {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) @IsOptional() rating?: number;
}

export class MoveStageDto {
  @ApiProperty({ enum: ApplicationStageDto, description: 'Illegal transitions are refused' })
  @IsEnum(ApplicationStageDto) stage!: ApplicationStageDto;
}

export class ApplicationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() jobId?: string;
  @ApiPropertyOptional({ enum: ApplicationStageDto }) @IsEnum(ApplicationStageDto) @IsOptional() stage?: ApplicationStageDto;
}

export class CreateInterviewDto {
  @ApiProperty() @IsUUID() applicationId!: string;
  @ApiProperty() @IsDateString() scheduledAt!: string;
  @ApiPropertyOptional({ example: 'Technical round' }) @IsString() @IsOptional() round?: string;
  @ApiPropertyOptional({ example: 'Video' }) @IsString() @IsOptional() mode?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() interviewerId?: string;
}
export class UpdateInterviewDto extends PartialType(CreateInterviewDto) {}

export class InterviewFeedbackDto {
  @ApiPropertyOptional({ enum: InterviewStatusDto, default: InterviewStatusDto.COMPLETED })
  @IsEnum(InterviewStatusDto) @IsOptional() status?: InterviewStatusDto;
  @ApiPropertyOptional({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) @IsOptional() rating?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() feedback?: string;
}

export class InterviewQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() applicationId?: string;
  @ApiPropertyOptional({ enum: InterviewStatusDto }) @IsEnum(InterviewStatusDto) @IsOptional() status?: InterviewStatusDto;
  @ApiPropertyOptional({ description: 'true for scheduled and still ahead' }) @IsString() @IsOptional() upcoming?: string;
}

export class CreateOfferDto {
  @ApiProperty() @IsUUID() applicationId!: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) salaryAmount!: number;
  @ApiPropertyOptional({ default: 'USD' }) @IsString() @IsOptional() currency?: string;
  @ApiProperty() @IsDateString() startsOn!: string;
  @ApiPropertyOptional({ enum: OfferStatusDto }) @IsEnum(OfferStatusDto) @IsOptional() status?: OfferStatusDto;
}

export class AcceptOfferDto {
  @ApiPropertyOptional({ description: 'Server allocates one when omitted' })
  @IsString() @IsOptional() employeeCode?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() departmentId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() designationId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() reportsToId?: string;
}

export class DeclineOfferDto {
  @ApiPropertyOptional() @IsString() @IsOptional() reason?: string;
}

export class OfferQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OfferStatusDto }) @IsEnum(OfferStatusDto) @IsOptional() status?: OfferStatusDto;
  @ApiPropertyOptional() @IsUUID() @IsOptional() applicationId?: string;
}
