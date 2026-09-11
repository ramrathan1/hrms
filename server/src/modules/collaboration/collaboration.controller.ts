import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CollaborationService } from './collaboration.service';
import {
  ChannelQueryDto, CreateChannelDto, CreateDirectChannelDto, EditMessageDto,
  MessageHistoryDto, ReactDto, SendMessageDto, SetChannelMembersDto, UpdateChannelDto,
} from './dto/collaboration.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Channels')
@ApiBearerAuth()
@Controller('channels')
export class CollaborationController {
  constructor(private readonly collab: CollaborationService) {}

  @Get()
  @RequirePermissions('channels:read')
  @ApiOperation({
    summary: 'Channels you can see',
    description: 'Public channels plus any private channel or DM you are a member of.',
  })
  findAll(@Query() query: ChannelQueryDto) { return this.collab.findAll(query); }

  @Get(':id') @RequirePermissions('channels:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.collab.findOne(id); }

  @Get(':id/messages')
  @RequirePermissions('channels:read')
  @ApiOperation({ summary: 'Message history; membership is checked first' })
  history(@Param('id', ParseUUIDPipe) id: string, @Query() query: MessageHistoryDto) {
    return this.collab.history(id, query);
  }

  @Post() @RequirePermissions('channels:create')
  create(@Body() dto: CreateChannelDto) { return this.collab.createChannel(dto); }

  @Post('direct')
  @RequirePermissions('channels:create')
  @ApiOperation({ summary: 'Open a DM; reuses the existing conversation if there is one' })
  direct(@Body() dto: CreateDirectChannelDto) { return this.collab.openDirect(dto); }

  @Patch(':id') @RequirePermissions('channels:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateChannelDto) {
    return this.collab.updateChannel(id, dto);
  }

  @Put(':id/members') @RequirePermissions('channels:update')
  setMembers(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetChannelMembersDto) {
    return this.collab.setMembers(id, dto.userIds);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('channels:read')
  @ApiOperation({ summary: 'Join a public channel; private ones need an invite' })
  join(@Param('id', ParseUUIDPipe) id: string) { return this.collab.join(id); }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('channels:read')
  leave(@Param('id', ParseUUIDPipe) id: string) { return this.collab.leave(id); }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('channels:read')
  markRead(@Param('id', ParseUUIDPipe) id: string) { return this.collab.markRead(id); }

  @Post(':id/messages')
  @RequirePermissions('channels:create')
  @ApiOperation({ summary: 'Post a message over HTTP; the socket path is chat:send' })
  post(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto) {
    return this.collab.postMessage(id, dto);
  }

  @Delete(':id') @RequirePermissions('channels:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.collab.remove(id); }
}

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private readonly collab: CollaborationService) {}

  @Post(':id/react')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('channels:read')
  @ApiOperation({ summary: 'Toggle a reaction' })
  react(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReactDto) {
    return this.collab.react(id, dto);
  }

  @Patch(':id')
  @RequirePermissions('channels:update')
  @ApiOperation({ summary: 'Edit your own message' })
  edit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EditMessageDto) {
    return this.collab.editMessage(id, dto.body);
  }

  @Delete(':id')
  @RequirePermissions('channels:delete')
  @ApiOperation({ summary: 'Delete your own message' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.collab.deleteMessage(id); }
}
