import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum EmployeeStatusDto { ACTIVE = 'ACTIVE', ON_LEAVE = 'ON_LEAVE', EXITED = 'EXITED' }
export enum EmploymentTypeDto {
  FULL_TIME = 'FULL_TIME', PART_TIME = 'PART_TIME', CONTRACT = 'CONTRACT',
  INTERN = 'INTERN', TRAINEE = 'TRAINEE',
}

export class CreateEmployeeDto {
  @ApiProperty() @IsString() @MinLength(1, { message: 'Enter the full name' }) name!: string;
  @ApiProperty() @IsEmail({}, { message: 'Enter a valid email address' }) email!: string;
  @ApiPropertyOptional({ description: 'Server allocates one when omitted' })
  @IsString() @IsOptional() employeeCode?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() departmentId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() designationId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() reportsToId?: string;
  @ApiPropertyOptional({ description: 'Link to a login account' })
  @IsUUID() @IsOptional() userId?: string;
  @ApiProperty({ example: '2026-01-15' }) @IsDateString() joinedOn!: string;
  @ApiPropertyOptional({ default: 0 })
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() hourlyRate?: number;
  @ApiPropertyOptional({ enum: EmploymentTypeDto })
  @IsEnum(EmploymentTypeDto) @IsOptional() employmentType?: EmploymentTypeDto;
  @ApiPropertyOptional({ enum: EmployeeStatusDto })
  @IsEnum(EmployeeStatusDto) @IsOptional() status?: EmployeeStatusDto;
  @ApiPropertyOptional() @IsString() @IsOptional() address?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() about?: string;
}
export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}

export class EmployeeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EmployeeStatusDto })
  @IsEnum(EmployeeStatusDto) @IsOptional() status?: EmployeeStatusDto;
  @ApiPropertyOptional() @IsUUID() @IsOptional() departmentId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() designationId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() reportsToId?: string;
}

export class CreateDepartmentDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() parentId?: string;
}
export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

export class CreateDesignationDto {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
}
export class UpdateDesignationDto extends PartialType(CreateDesignationDto) {}
