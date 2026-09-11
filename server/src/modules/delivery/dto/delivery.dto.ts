import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateContractDto {
  @ApiProperty() @IsString() @MinLength(3) title!: string;
  @ApiPropertyOptional({ description: 'Generated when omitted' })
  @IsString() @IsOptional() number?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
  @ApiPropertyOptional() @IsUUID() @IsOptional() projectId?: string;
  @ApiPropertyOptional({ enum: ['Support', 'Development', 'Retainer', 'Other'] })
  @IsString() @IsOptional() kind?: string;
  @ApiPropertyOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @IsOptional() value?: number;
  @ApiPropertyOptional() @IsDateString() @IsOptional() startsOn?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() endsOn?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}
export class UpdateContractDto extends PartialType(CreateContractDto) {}

export class ContractQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() clientId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
}

export class CreateDiscussionDto {
  @ApiProperty() @IsUUID() projectId!: string;
  @ApiProperty() @IsString() @MinLength(3) title!: string;
  @ApiProperty() @IsString() @MinLength(1) body!: string;
}
export class UpdateDiscussionDto extends PartialType(CreateDiscussionDto) {}

export class DiscussionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() projectId?: string;
}

export class ReplyDto {
  @ApiProperty() @IsString() @MinLength(1, { message: 'Write something first' }) body!: string;
}

export class CreateIdeaDto {
  @ApiProperty() @IsString() @MinLength(3) title!: string;
  @ApiPropertyOptional() @IsString() @IsOptional() detail?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional({ enum: ['Under Review', 'Planned', 'In Progress', 'Shipped', 'Declined'] })
  @IsString() @IsOptional() status?: string;
}
export class UpdateIdeaDto extends PartialType(CreateIdeaDto) {}

export class IdeaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsString() @IsOptional() status?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
}
