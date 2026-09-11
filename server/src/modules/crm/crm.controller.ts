import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DealsService, LeadNotesService, LeadsService, PipelineStagesService } from './crm.service';
import {
  ConvertLeadDto, CreateDealDto, CreateLeadDto, CreateLeadNoteDto, CreateStageDto,
  DealQueryDto, LeadQueryDto, MoveDealDto, UpdateDealDto, UpdateLeadDto, UpdateStageDto,
  LeadNoteQueryDto,
} from './dto/crm.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Leads')
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get() @RequirePermissions('leads:read')
  findAll(@Query() query: LeadQueryDto) { return this.leads.findAll(query); }

  @Get(':id') @RequirePermissions('leads:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.leads.findOne(id); }

  @Post() @RequirePermissions('leads:create')
  create(@Body() dto: CreateLeadDto) { return this.leads.createLead(dto); }

  @Patch(':id') @RequirePermissions('leads:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.updateLead(id, dto);
  }

  @Delete(':id') @RequirePermissions('leads:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.leads.remove(id); }

  @Post(':id/notes') @RequirePermissions('leads:update')
  addNote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateLeadNoteDto) {
    return this.leads.addNote(id, dto);
  }

  @Post(':id/convert')
  @RequirePermissions('leads:convert')
  @ApiOperation({
    summary: 'Convert a lead into a client',
    description:
      'Creates the client, optionally opens a project, and marks the lead converted — all in ' +
      'one transaction. Refused if the lead was already converted.',
  })
  convert(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConvertLeadDto) {
    return this.leads.convert(id, dto);
  }
}

@ApiTags('Deals')
@ApiBearerAuth()
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get() @RequirePermissions('deals:read')
  findAll(@Query() query: DealQueryDto) { return this.deals.findAll(query); }

  @Get('pipeline')
  @RequirePermissions('deals:read')
  @ApiOperation({ summary: 'Pipeline board — stages with open deals and totals (cached 30s)' })
  pipeline() { return this.deals.pipeline(); }

  @Get(':id') @RequirePermissions('deals:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.deals.findOne(id); }

  @Post() @RequirePermissions('deals:create')
  create(@Body() dto: CreateDealDto) { return this.deals.createDeal(dto); }

  @Patch(':id') @RequirePermissions('deals:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDealDto) {
    return this.deals.updateDeal(id, dto);
  }

  @Patch(':id/stage')
  @RequirePermissions('deals:update')
  @ApiOperation({ summary: 'Move a deal; a terminal stage closes it' })
  move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveDealDto) {
    return this.deals.moveToStage(id, dto);
  }

  @Delete(':id') @RequirePermissions('deals:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.deals.remove(id); }
}

@ApiTags('Pipeline stages')
@ApiBearerAuth()
@Controller('pipeline-stages')
export class PipelineStagesController {
  constructor(private readonly stages: PipelineStagesService) {}

  @Get() @RequirePermissions('deals:read')
  findAll(@Query() query: DealQueryDto) { return this.stages.findAll(query); }

  @Post() @RequirePermissions('deals:create')
  create(@Body() dto: CreateStageDto) { return this.stages.createStage(dto); }

  @Patch(':id') @RequirePermissions('deals:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStageDto) {
    return this.stages.update(id, { ...dto });
  }

  @Delete(':id')
  @RequirePermissions('deals:delete')
  @ApiOperation({ summary: 'Delete a stage; refused while deals sit in it' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.stages.remove(id); }
}

/** Read side of lead notes across every lead. Writes stay on the lead. */
@ApiTags('Lead notes')
@ApiBearerAuth()
@Controller('lead-notes')
export class LeadNotesController {
  constructor(private readonly notes: LeadNotesService) {}

  @Get()
  @RequirePermissions('leads:read')
  findAll(@Query() query: LeadNoteQueryDto) {
    return this.notes.findAll(query);
  }
}
