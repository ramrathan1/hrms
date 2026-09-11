import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum ProjectStatusDto {
  NOT_STARTED = 'NOT_STARTED', IN_PROGRESS = 'IN_PROGRESS', ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED', CANCELLED = 'CANCELLED',
}
export enum TaskStatusDto {
  INCOMPLETE = 'INCOMPLETE', TODO = 'TODO', DOING = 'DOING', COMPLETED = 'COMPLETED',
}
export enum TaskPriorityDto { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH', URGENT = 'URGENT' }
export enum MilestoneStatusDto {
  NOT_STARTED = 'NOT_STARTED', IN_PROGRESS = 'IN_PROGRESS', COMPLETE = 'COMPLETE',
}
export enum TaskSourceDto { CHAT = 'CHAT', MEETING = 'MEETING', TICKET = 'TICKET', MANUAL = 'MANUAL' }

export class CreateProjectDto {
  @ApiProperty() @IsString() @MinLength(1, { message: 'Give the project a name' }) name!: string;
  @ApiPropertyOptional({ description: 'Server allocates one when omitted' }) @IsString() @IsOptional() code?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() summary?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
  @ApiPropertyOptional({ enum: ProjectStatusDto }) @IsEnum(ProjectStatusDto) @IsOptional() status?: ProjectStatusDto;
  @ApiPropertyOptional() @IsDateString() @IsOptional() startsOn?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() deadlineOn?: string;
  @ApiPropertyOptional({ default: 0 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() budget?: number;
  @ApiPropertyOptional({ default: 'USD' }) @IsString() @IsOptional() currency?: string;
  @ApiPropertyOptional({
    default: 0,
    description: 'Percent complete. Set it when importing work already underway.',
  })
  @IsInt() @Min(0) @Max(100) @IsOptional() progress?: number;

  @ApiPropertyOptional({ type: [String] }) @IsArray() @IsUUID('4', { each: true }) @IsOptional() memberIds?: string[];
}
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class SetMembersDto {
  @ApiProperty({ type: [String], description: 'Replaces the member list entirely' })
  @IsArray() @IsUUID('4', { each: true }) userIds!: string[];
}

export class ProjectQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ProjectStatusDto }) @IsEnum(ProjectStatusDto) @IsOptional() status?: ProjectStatusDto;
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() memberId?: string;
  @ApiPropertyOptional({ description: 'true for past deadline and unfinished' }) @IsString() @IsOptional() atRisk?: string;
}

export class CreateMilestoneDto {
  @ApiProperty() @IsUUID() projectId!: string;
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiPropertyOptional({ default: 0 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() cost?: number;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dueOn?: string;
  @ApiPropertyOptional({ enum: MilestoneStatusDto }) @IsEnum(MilestoneStatusDto) @IsOptional() status?: MilestoneStatusDto;
  @ApiPropertyOptional({ default: 0 }) @IsNumber() @Min(0) @IsOptional() position?: number;
}
export class UpdateMilestoneDto extends PartialType(CreateMilestoneDto) {}

export class CreateTaskDto {
  @ApiProperty() @IsString() @MinLength(1, { message: 'Give the task a title' }) title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() code?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() projectId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() milestoneId?: string;
  @ApiPropertyOptional({ enum: TaskStatusDto }) @IsEnum(TaskStatusDto) @IsOptional() status?: TaskStatusDto;
  @ApiPropertyOptional({ enum: TaskPriorityDto }) @IsEnum(TaskPriorityDto) @IsOptional() priority?: TaskPriorityDto;
  @ApiPropertyOptional() @IsDateString() @IsOptional() dueOn?: string;
  @ApiPropertyOptional({ default: 0 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() estimatedHours?: number;
  @ApiPropertyOptional({ type: [String] }) @IsArray() @IsUUID('4', { each: true }) @IsOptional() assigneeIds?: string[];
  @ApiPropertyOptional({ enum: TaskSourceDto, description: 'Where the task came from' })
  @IsEnum(TaskSourceDto) @IsOptional() sourceType?: TaskSourceDto;
  @ApiPropertyOptional({ description: 'Id of the message or meeting it came from' })
  @IsString() @IsOptional() sourceRef?: string;
}
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

export class MoveTaskDto {
  @ApiProperty({ enum: TaskStatusDto }) @IsEnum(TaskStatusDto) status!: TaskStatusDto;
}

export class TaskQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() projectId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() milestoneId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() assigneeId?: string;
  @ApiPropertyOptional({ enum: TaskStatusDto }) @IsEnum(TaskStatusDto) @IsOptional() status?: TaskStatusDto;
  @ApiPropertyOptional({ enum: TaskPriorityDto }) @IsEnum(TaskPriorityDto) @IsOptional() priority?: TaskPriorityDto;
  @ApiPropertyOptional({ description: 'true for past due and not completed' }) @IsString() @IsOptional() overdue?: string;
}

export class CreateTimeLogDto {
  @ApiProperty() @IsUUID() employeeId!: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() taskId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() projectId?: string;
  @ApiProperty() @IsDateString() startedAt!: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endedAt?: string;
  @ApiPropertyOptional({ description: 'Computed from the range when omitted' })
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() hours?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() note?: string;
  @ApiPropertyOptional({ default: true }) @IsBoolean() @IsOptional() billable?: boolean;
}
export class UpdateTimeLogDto extends PartialType(CreateTimeLogDto) {}

export class TimeLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() projectId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() taskId?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() from?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() to?: string;
}

export class TimesheetQueryDto {
  @ApiProperty() @IsDateString() from!: string;
  @ApiProperty() @IsDateString() to!: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() employeeId?: string;
}
