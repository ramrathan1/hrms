import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ClientContactsService, ClientsService } from './clients.service';
import {
  ClientQueryDto, ClientStatementQueryDto, CreateClientDto, CreateContactDto,
  UpdateClientDto, UpdateContactDto,
  ContactQueryDto,
} from './dto/client.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @RequirePermissions('clients:read')
  @ApiOperation({ summary: 'List clients' })
  findAll(@Query() query: ClientQueryDto) {
    return this.clients.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('clients:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.findOne(id);
  }

  @Get(':id/statement')
  @RequirePermissions('clients:read')
  @ApiOperation({ summary: 'Account statement — billed, paid and outstanding' })
  statement(@Param('id', ParseUUIDPipe) id: string, @Query() query: ClientStatementQueryDto) {
    return this.clients.statement(id, query);
  }

  @Post()
  @RequirePermissions('clients:create')
  create(@Body() dto: CreateClientDto) {
    return this.clients.createClient(dto);
  }

  @Patch(':id')
  @RequirePermissions('clients:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto) {
    return this.clients.updateClient(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('clients:delete')
  @ApiOperation({ summary: 'Delete a client; refused while invoices or projects reference it' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.remove(id);
  }

  /* ------------------------------------------------------- contacts */

  @Post(':id/contacts')
  @RequirePermissions('clients:update')
  addContact(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateContactDto) {
    return this.clients.addContact(id, dto);
  }

  @Patch(':id/contacts/:contactId')
  @RequirePermissions('clients:update')
  updateContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.clients.updateContact(id, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @RequirePermissions('clients:update')
  removeContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.clients.removeContact(id, contactId);
  }
}

/** Read side of every client contact at once. Writes stay on the client. */
@ApiTags('Client contacts')
@ApiBearerAuth()
@Controller('client-contacts')
export class ClientContactsController {
  constructor(private readonly contacts: ClientContactsService) {}

  @Get()
  @RequirePermissions('clients:read')
  findAll(@Query() query: ContactQueryDto) {
    return this.contacts.findAll(query);
  }
}
