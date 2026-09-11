import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ContractsService, DiscussionsService, RoadmapService } from './delivery.service';
import {
  ContractQueryDto, CreateContractDto, CreateDiscussionDto, CreateIdeaDto,
  DiscussionQueryDto, IdeaQueryDto, ReplyDto, UpdateContractDto,
  UpdateDiscussionDto, UpdateIdeaDto,
} from './dto/delivery.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  @RequirePermissions('contracts:read')
  findAll(@Query() query: ContractQueryDto) {
    return this.contracts.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('contracts:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contracts.findOne(id);
  }

  @Post()
  @RequirePermissions('contracts:create')
  create(@Body() dto: CreateContractDto) {
    return this.contracts.createContract(dto);
  }

  @Patch(':id')
  @RequirePermissions('contracts:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto) {
    return this.contracts.updateContract(id, dto);
  }

  @Post(':id/sign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('contracts:update')
  @ApiOperation({ summary: 'Record the signature. Cannot be undone.' })
  sign(@Param('id', ParseUUIDPipe) id: string) {
    return this.contracts.sign(id);
  }

  @Delete(':id')
  @RequirePermissions('contracts:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.contracts.remove(id);
  }
}

@ApiTags('Discussions')
@ApiBearerAuth()
@Controller('discussions')
export class DiscussionsController {
  constructor(private readonly discussions: DiscussionsService) {}

  @Get()
  @RequirePermissions('projects:read')
  findAll(@Query() query: DiscussionQueryDto) {
    return this.discussions.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('projects:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.discussions.findOne(id);
  }

  @Post()
  @RequirePermissions('projects:update')
  create(@Body() dto: CreateDiscussionDto) {
    return this.discussions.start(dto);
  }

  @Patch(':id')
  @RequirePermissions('projects:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDiscussionDto) {
    return this.discussions.updateDiscussion(id, dto);
  }

  @Post(':id/replies')
  @RequirePermissions('projects:update')
  reply(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyDto) {
    return this.discussions.reply(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('projects:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.discussions.remove(id);
  }
}

@ApiTags('Roadmap')
@ApiBearerAuth()
@Controller('roadmap')
export class RoadmapController {
  constructor(private readonly roadmap: RoadmapService) {}

  @Get()
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: 'Ideas with vote counts and whether you voted' })
  findAll(@Query() query: IdeaQueryDto) {
    return this.roadmap.findAll(query);
  }

  @Post()
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: 'Anyone who can see the roadmap may suggest something' })
  create(@Body() dto: CreateIdeaDto) {
    return this.roadmap.createIdea(dto);
  }

  @Patch(':id')
  @RequirePermissions('projects:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIdeaDto) {
    return this.roadmap.updateIdea(id, dto);
  }

  @Post(':id/vote')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: 'Add or take back your vote' })
  vote(@Param('id', ParseUUIDPipe) id: string) {
    return this.roadmap.toggleVote(id);
  }

  @Delete(':id')
  @RequirePermissions('projects:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.roadmap.remove(id);
  }
}
