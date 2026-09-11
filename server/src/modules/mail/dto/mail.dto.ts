import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsOptional,
  IsString, IsUUID, Max, Min, MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum MailFolderDto {
  INBOX = 'INBOX', SENT = 'SENT', DRAFTS = 'DRAFTS',
  ARCHIVE = 'ARCHIVE', SPAM = 'SPAM', TRASH = 'TRASH',
}
export enum MailSecurityDto { SSL_TLS = 'SSL/TLS', STARTTLS = 'STARTTLS', NONE = 'None' }

/* --------------------------------------------------------------- accounts */

export class CreateMailAccountDto {
  @ApiProperty({ example: 'Mohammed Ziemann' })
  @IsString() @MinLength(1, { message: 'Enter a display name' }) displayName!: string;

  @ApiProperty({ example: 'you@company.com' })
  @IsEmail({}, { message: 'Enter a valid email address' }) email!: string;

  @ApiPropertyOptional({ example: 'Gmail' }) @IsString() @IsOptional() provider?: string;

  @ApiProperty({ example: 'imap.gmail.com' })
  @IsString() @MinLength(1, { message: 'Enter the IMAP host' }) imapHost!: string;

  @ApiPropertyOptional({ default: 993 })
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) @IsOptional() imapPort?: number;

  @ApiPropertyOptional({ enum: MailSecurityDto }) @IsEnum(MailSecurityDto) @IsOptional() imapSecurity?: MailSecurityDto;

  @ApiProperty({ example: 'smtp.gmail.com' })
  @IsString() @MinLength(1, { message: 'Enter the SMTP host' }) smtpHost!: string;

  @ApiPropertyOptional({ default: 587 })
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) @IsOptional() smtpPort?: number;

  @ApiPropertyOptional({ enum: MailSecurityDto }) @IsEnum(MailSecurityDto) @IsOptional() smtpSecurity?: MailSecurityDto;

  @ApiPropertyOptional({ description: 'Usually the full email address' })
  @IsString() @IsOptional() username?: string;

  @ApiPropertyOptional({
    description: 'Encrypted at rest and never returned. Most providers need an app password.',
  })
  @IsString() @IsOptional() password?: string;

  @ApiPropertyOptional() @IsString() @IsOptional() signature?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isDefault?: boolean;
}

export class UpdateMailAccountDto extends PartialType(CreateMailAccountDto) {}

export class TestConnectionDto {
  @ApiPropertyOptional({ description: 'Test a saved account using its stored password' })
  @IsUUID() @IsOptional() accountId?: string;

  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() imapHost!: string;
  @ApiPropertyOptional({ default: 993 }) @Type(() => Number) @IsInt() @IsOptional() imapPort?: number;
  @ApiPropertyOptional({ enum: MailSecurityDto }) @IsEnum(MailSecurityDto) @IsOptional() imapSecurity?: MailSecurityDto;
  @ApiProperty() @IsString() smtpHost!: string;
  @ApiPropertyOptional({ default: 587 }) @Type(() => Number) @IsInt() @IsOptional() smtpPort?: number;
  @ApiPropertyOptional({ enum: MailSecurityDto }) @IsEnum(MailSecurityDto) @IsOptional() smtpSecurity?: MailSecurityDto;
  @ApiPropertyOptional() @IsString() @IsOptional() username?: string;
  @ApiPropertyOptional({ description: 'Falls back to the stored password when accountId is given' })
  @IsString() @IsOptional() password?: string;
}

/* --------------------------------------------------------------- messages */

export class ThreadQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MailFolderDto, default: MailFolderDto.INBOX })
  @IsEnum(MailFolderDto) @IsOptional() folder?: MailFolderDto;
  @ApiPropertyOptional() @IsUUID() @IsOptional() accountId?: string;
  @ApiPropertyOptional({ description: 'true for starred only' }) @IsString() @IsOptional() starred?: string;
  @ApiPropertyOptional({ description: 'true for unread only' }) @IsString() @IsOptional() unread?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() label?: string;
}

export class MessageQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsUUID() @IsOptional() accountId?: string;
  @ApiPropertyOptional({ enum: MailFolderDto }) @IsEnum(MailFolderDto) @IsOptional() folder?: MailFolderDto;
  @ApiPropertyOptional() @IsString() @IsOptional() threadKey?: string;
}

export class UpdateFlagsDto {
  @ApiProperty({ type: [String] })
  @IsArray() @ArrayNotEmpty({ message: 'Select at least one message' }) @IsUUID('4', { each: true })
  messageIds!: string[];

  @ApiPropertyOptional() @IsBoolean() @IsOptional() isRead?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() isStarred?: boolean;
}

export class MoveMessagesDto {
  @ApiProperty({ type: [String] })
  @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true }) messageIds!: string[];

  @ApiProperty({ enum: MailFolderDto }) @IsEnum(MailFolderDto) folder!: MailFolderDto;
}

export class DeleteMessagesDto {
  @ApiProperty({ type: [String], description: 'Trash first; a second call deletes for good' })
  @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true }) messageIds!: string[];
}

export class SendMailDto {
  @ApiPropertyOptional({ description: 'Defaults to the default account' })
  @IsUUID() @IsOptional() accountId?: string;

  @ApiProperty({ example: 'someone@example.com, Other <other@example.com>' })
  @IsString() to!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() cc?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() subject?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() body?: string;

  @ApiPropertyOptional({ description: 'Keeps a reply in the same conversation' })
  @IsString() @IsOptional() threadKey?: string;

  @ApiPropertyOptional({ description: 'Draft this replaces on send' })
  @IsUUID() @IsOptional() draftId?: string;
}
