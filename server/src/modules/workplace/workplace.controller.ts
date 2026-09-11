import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  AssetsService, EventsService, KbService, LettersService, NoticesService,
} from './workplace.service';
import {
  AssetQueryDto, AssignAssetDto, CreateAssetDto, CreateEventDto, CreateKbArticleDto,
  CreateNoticeDto, CreateTemplateDto, EventQueryDto, GenerateLetterDto, KbQueryDto,
  NoticeQueryDto, PreviewLetterDto, UpdateAssetDto, UpdateEventDto, UpdateKbArticleDto,
  UpdateNoticeDto, UpdateTemplateDto,
} from './dto/workplace.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get() @RequirePermissions('assets:read')
  findAll(@Query() query: AssetQueryDto) { return this.assets.findAll(query); }

  @Get(':id/history')
  @RequirePermissions('assets:read')
  @ApiOperation({ summary: 'Every hand-over for this asset' })
  history(@Param('id', ParseUUIDPipe) id: string) { return this.assets.history(id); }

  @Post() @RequirePermissions('assets:create')
  create(@Body() dto: CreateAssetDto) { return this.assets.createAsset(dto); }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('assets:update')
  @ApiOperation({ summary: 'Assign or return; always records a movement' })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignAssetDto) {
    return this.assets.assign(id, dto);
  }

  @Patch(':id') @RequirePermissions('assets:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssetDto) {
    return this.assets.update(id, { ...dto });
  }

  @Delete(':id') @RequirePermissions('assets:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.assets.remove(id); }
}

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get() @RequirePermissions('events:read')
  findAll(@Query() query: EventQueryDto) { return this.events.findAll(query); }

  @Post() @RequirePermissions('events:create')
  create(@Body() dto: CreateEventDto) { return this.events.createEvent(dto); }

  @Patch(':id') @RequirePermissions('events:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto) {
    return this.events.update(id, { ...dto });
  }

  @Delete(':id') @RequirePermissions('events:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.events.remove(id); }
}

@ApiTags('Notices')
@ApiBearerAuth()
@Controller('notices')
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get() @RequirePermissions('notices:read')
  findAll(@Query() query: NoticeQueryDto) { return this.notices.findAll(query); }

  @Post() @RequirePermissions('notices:create')
  create(@Body() dto: CreateNoticeDto) { return this.notices.createNotice(dto); }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('notices:update')
  publish(@Param('id', ParseUUIDPipe) id: string) { return this.notices.publish(id); }

  @Patch(':id') @RequirePermissions('notices:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNoticeDto) {
    return this.notices.update(id, { ...dto, publish: undefined });
  }

  @Delete(':id') @RequirePermissions('notices:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.notices.remove(id); }
}

@ApiTags('Knowledge base')
@ApiBearerAuth()
@Controller('knowledge')
export class KbController {
  constructor(private readonly kb: KbService) {}

  @Get() @RequirePermissions('knowledge:read')
  findAll(@Query() query: KbQueryDto) { return this.kb.findAll(query); }

  @Get(':id') @RequirePermissions('knowledge:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.kb.findOne(id); }

  @Post() @RequirePermissions('knowledge:create')
  create(@Body() dto: CreateKbArticleDto) { return this.kb.createArticle(dto); }

  @Patch(':id') @RequirePermissions('knowledge:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateKbArticleDto) {
    return this.kb.update(id, { ...dto });
  }

  @Delete(':id') @RequirePermissions('knowledge:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.kb.remove(id); }
}

@ApiTags('Letters')
@ApiBearerAuth()
@Controller('letters')
export class LettersController {
  constructor(private readonly letters: LettersService) {}

  @Get('templates') @RequirePermissions('letters:read')
  templates(@Query() query: KbQueryDto) { return this.letters.findAll(query); }

  @Get('merge-fields')
  @RequirePermissions('letters:read')
  @ApiOperation({ summary: 'Tokens a template may use' })
  mergeFields() { return this.letters.mergeFields(); }

  @Get('generated')
  @RequirePermissions('letters:read')
  @ApiOperation({ summary: 'Letters already issued' })
  generated(@Query('employeeId') employeeId?: string) {
    return this.letters.listGenerated(employeeId);
  }

  @Post('templates') @RequirePermissions('letters:create')
  createTemplate(@Body() dto: CreateTemplateDto) { return this.letters.createTemplate(dto); }

  @Patch('templates/:id') @RequirePermissions('letters:update')
  updateTemplate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateDto) {
    return this.letters.update(id, { ...dto });
  }

  @Delete('templates/:id') @RequirePermissions('letters:delete')
  removeTemplate(@Param('id', ParseUUIDPipe) id: string) { return this.letters.remove(id); }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('letters:read')
  @ApiOperation({
    summary: 'Merge without saving',
    description: 'Unrecognised tokens are returned in `unresolved` and left visible in the body.',
  })
  preview(@Body() dto: PreviewLetterDto) { return this.letters.preview(dto); }

  @Post('generate')
  @RequirePermissions('letters:create')
  @ApiOperation({ summary: 'Issue a letter; the merged body is stored as a snapshot' })
  generate(@Body() dto: GenerateLetterDto) { return this.letters.generate(dto); }

  @Delete('generated/:id')
  @RequirePermissions('letters:delete')
  @ApiOperation({ summary: 'Withdraw an issued letter' })
  removeGenerated(@Param('id', ParseUUIDPipe) id: string) {
    return this.letters.removeGenerated(id);
  }
}
