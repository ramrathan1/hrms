import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { TicketsService } from './support.service';
import {
  CreateReplyDto, CreateTicketDto, TicketQueryDto, UpdateTicketDto,
} from './dto/support.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get() @RequirePermissions('tickets:read')
  findAll(@Query() query: TicketQueryDto) { return this.tickets.findAll(query); }

  @Get('stats') @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Ticket counts by status' })
  stats() { return this.tickets.stats(); }

  @Get(':id') @RequirePermissions('tickets:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.tickets.findOne(id); }

  @Post() @RequirePermissions('tickets:create')
  create(@Body() dto: CreateTicketDto) { return this.tickets.createTicket(dto); }

  @Patch(':id') @RequirePermissions('tickets:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto) {
    return this.tickets.updateTicket(id, dto);
  }

  @Post(':id/replies')
  @RequirePermissions('tickets:update')
  @ApiOperation({ summary: 'Reply; a public reply reopens a resolved ticket' })
  reply(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateReplyDto) {
    return this.tickets.reply(id, dto);
  }

  @Delete(':id') @RequirePermissions('tickets:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.tickets.remove(id); }
}
