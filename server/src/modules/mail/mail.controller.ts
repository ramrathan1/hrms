import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { MailAccountsService } from './mail-accounts.service';
import { MailMessagesService } from './mail-messages.service';
import {
  CreateMailAccountDto, DeleteMessagesDto, MessageQueryDto, MoveMessagesDto,
  SendMailDto, TestConnectionDto, ThreadQueryDto, UpdateFlagsDto, UpdateMailAccountDto,
} from './dto/mail.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Mail accounts')
@ApiBearerAuth()
@Controller('mail/accounts')
export class MailAccountsController {
  constructor(private readonly accounts: MailAccountsService) {}

  @Get('providers')
  @RequirePermissions('mail:manage')
  @ApiOperation({ summary: 'Known provider presets — host, port and security' })
  providers() { return this.accounts.providers(); }

  @Get()
  @RequirePermissions('mail:manage')
  @ApiOperation({ summary: 'Your connected accounts. Passwords are never returned.' })
  findAll() { return this.accounts.findAll(); }

  @Get(':id') @RequirePermissions('mail:manage')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.accounts.findOne(id); }

  @Post()
  @RequirePermissions('mail:manage')
  @ApiOperation({ summary: 'Connect an account; the password is encrypted at rest' })
  create(@Body() dto: CreateMailAccountDto) { return this.accounts.create(dto); }

  @Patch(':id')
  @RequirePermissions('mail:manage')
  @ApiOperation({ summary: 'Update an account; omit password to leave it unchanged' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMailAccountDto) {
    return this.accounts.update(id, dto);
  }

  @Delete(':id') @RequirePermissions('mail:manage')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.accounts.remove(id); }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('mail:manage')
  @ApiOperation({
    summary: 'Test IMAP and SMTP for real',
    description:
      'Opens an IMAP session and verifies the SMTP transport, reporting each step. ' +
      'Failures are translated — an auth rejection usually means the provider wants an app password.',
  })
  test(@Body() dto: TestConnectionDto) { return this.accounts.testConnection(dto); }

  @Post(':id/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('mail:manage')
  @ApiOperation({ summary: 'Queue a mailbox sync; returns immediately with a job id' })
  sync(@Param('id', ParseUUIDPipe) id: string) { return this.accounts.requestSync(id); }
}

@ApiTags('Mail')
@ApiBearerAuth()
@Controller('mail')
export class MailController {
  constructor(private readonly messages: MailMessagesService) {}

  @Get('threads')
  @RequirePermissions('mail:manage')
  @ApiOperation({ summary: 'Conversation list for a folder, grouped and paged by thread' })
  threads(@Query() query: ThreadQueryDto) { return this.messages.threads(query); }

  @Get('threads/:threadKey')
  @RequirePermissions('mail:manage')
  @ApiOperation({ summary: 'Every message in one conversation, oldest first' })
  thread(@Param('threadKey') threadKey: string, @Query('accountId') accountId?: string) {
    return this.messages.thread(threadKey, accountId);
  }

  @Get('messages') @RequirePermissions('mail:manage')
  findAll(@Query() query: MessageQueryDto) { return this.messages.findAll(query); }

  @Get('folder-counts')
  @RequirePermissions('mail:manage')
  @ApiOperation({ summary: 'Unread count per folder' })
  counts(@Query('accountId') accountId?: string) { return this.messages.folderCounts(accountId); }

  @Patch('flags')
  @RequirePermissions('mail:manage')
  @ApiOperation({ summary: 'Mark read/unread or star/unstar in bulk' })
  flags(@Body() dto: UpdateFlagsDto) { return this.messages.setFlags(dto); }

  @Patch('move')
  @RequirePermissions('mail:manage')
  move(@Body() dto: MoveMessagesDto) { return this.messages.move(dto); }

  @Delete('messages')
  @RequirePermissions('mail:manage')
  @ApiOperation({ summary: 'Trash, or delete for good if already in Trash' })
  remove(@Body() dto: DeleteMessagesDto) { return this.messages.remove(dto.messageIds); }

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('mail:manage')
  @ApiOperation({
    summary: 'Queue a message for delivery',
    description:
      'The message is written to Sent immediately and handed to the SMTP worker. ' +
      'If delivery ultimately fails it is returned to Drafts rather than silently lost.',
  })
  send(@Body() dto: SendMailDto) { return this.messages.send(dto); }

  @Post('drafts')
  @RequirePermissions('mail:manage')
  @ApiOperation({ summary: 'Save or update a draft; never queued' })
  draft(@Body() dto: SendMailDto) { return this.messages.saveDraft(dto); }
}
