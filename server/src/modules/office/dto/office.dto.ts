import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateFloorDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() position?: number;
}
export class UpdateFloorDto extends PartialType(CreateFloorDto) {}

export class CreateRoomDto {
  @ApiProperty() @IsUUID() floorId!: string;
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional({ enum: ['work', 'social', 'quiet', 'meeting'] })
  @IsString() @IsOptional() kind?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() icon?: string;
  @ApiPropertyOptional() @IsInt() @Min(1) @Max(200) @IsOptional() capacity?: number;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() position?: number;
}
export class UpdateRoomDto extends PartialType(CreateRoomDto) {}

export class CreateTeamMeetingDto {
  @ApiProperty() @IsString() @MinLength(2) title!: string;
  @ApiProperty({ example: '2026-09-15T10:00:00Z' }) @IsDateString() startsAt!: string;
  @ApiPropertyOptional() @IsInt() @Min(5) @Max(480) @IsOptional() durationMins?: number;
  @ApiPropertyOptional() @IsUUID() @IsOptional() projectId?: string;
  @ApiPropertyOptional({ type: [String], description: 'User ids to invite' })
  @IsArray() @IsUUID(undefined, { each: true }) @IsOptional() attendeeIds?: string[];
}
export class UpdateTeamMeetingDto extends PartialType(CreateTeamMeetingDto) {}

export class TeamMeetingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() projectId?: string;
  @ApiPropertyOptional({ description: 'Only meetings that have not finished' })
  @IsOptional() upcoming?: string | boolean;
}

export class CreateRecordingDto {
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiProperty() @IsString() roomKey!: string;
  @ApiProperty({ description: 'Attachment id from the upload' }) @IsUUID() fileId!: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() meetingId?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() durationSecs?: number;
}

export class RecordingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() meetingId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() roomKey?: string;
}
