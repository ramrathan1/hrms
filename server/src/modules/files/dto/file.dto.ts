import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/**
 * What an attachment can hang off. An allow-list rather than a free string:
 * `ownerType` is polymorphic, so an unchecked value would let a caller invent
 * a namespace that nothing ever cleans up.
 */
export const ATTACHMENT_OWNERS = [
  'project', 'task', 'client', 'invoice', 'expense', 'employee',
  'ticket', 'application', 'meeting', 'kbArticle', 'general',
] as const;

export class UploadFileDto {
  @ApiProperty({ enum: ATTACHMENT_OWNERS, description: 'What this file belongs to' })
  @IsIn(ATTACHMENT_OWNERS as unknown as string[])
  ownerType!: string;

  @ApiPropertyOptional({ description: 'Id of the owning record' })
  @IsUUID()
  @IsOptional()
  ownerId?: string;
}

export class FileQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ATTACHMENT_OWNERS })
  @IsIn(ATTACHMENT_OWNERS as unknown as string[])
  @IsOptional()
  ownerType?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  ownerId?: string;
}

export class AttachmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() ownerType!: string;
  @ApiProperty({ nullable: true }) ownerId!: string | null;
  @ApiProperty() createdAt!: Date;
}
