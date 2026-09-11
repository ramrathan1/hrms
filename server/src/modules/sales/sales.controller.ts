import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { LeadEmailsService, LeadFormsService, ProposalsService } from './sales.service';
import {
  CreateLeadEmailDto, CreateLeadFormDto, CreateProposalDto, LeadEmailQueryDto,
  ProposalQueryDto, UpdateLeadFormDto, UpdateProposalDto,
} from './dto/sales.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Lead forms')
@ApiBearerAuth()
@Controller('lead-forms')
export class LeadFormsController {
  constructor(private readonly forms: LeadFormsService) {}

  @Get()
  @RequirePermissions('leads:read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.forms.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('leads:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.forms.findOne(id);
  }

  @Post()
  @RequirePermissions('leads:create')
  create(@Body() dto: CreateLeadFormDto) {
    return this.forms.createForm(dto);
  }

  @Patch(':id')
  @RequirePermissions('leads:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadFormDto) {
    return this.forms.updateForm(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('leads:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.forms.remove(id);
  }
}

@ApiTags('Lead emails')
@ApiBearerAuth()
@Controller('lead-emails')
export class LeadEmailsController {
  constructor(private readonly emails: LeadEmailsService) {}

  @Get()
  @RequirePermissions('leads:read')
  findAll(@Query() query: LeadEmailQueryDto) {
    return this.emails.findAll(query);
  }

  @Post()
  @RequirePermissions('leads:update')
  @ApiOperation({ summary: 'Record an email sent to a lead' })
  create(@Body() dto: CreateLeadEmailDto) {
    return this.emails.log(dto);
  }

  @Delete(':id')
  @RequirePermissions('leads:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.emails.remove(id);
  }
}

@ApiTags('Proposals')
@ApiBearerAuth()
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get()
  @RequirePermissions('estimates:read')
  findAll(@Query() query: ProposalQueryDto) {
    return this.proposals.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('estimates:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.findOne(id);
  }

  @Post()
  @RequirePermissions('estimates:create')
  @ApiOperation({ summary: 'Draft a proposal; the number is issued by the server' })
  create(@Body() dto: CreateProposalDto) {
    return this.proposals.createProposal(dto);
  }

  @Patch(':id')
  @RequirePermissions('estimates:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProposalDto) {
    return this.proposals.updateProposal(id, dto);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('estimates:create')
  @ApiOperation({ summary: 'Raise an estimate from an accepted proposal' })
  convert(@Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.convertToEstimate(id);
  }

  @Delete(':id')
  @RequirePermissions('estimates:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.proposals.remove(id);
  }
}
