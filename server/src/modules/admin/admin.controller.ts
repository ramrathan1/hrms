import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuditService, ReportsService, RolesService, SettingsService } from './admin.service';
import { AuditQueryDto, SaveSettingDto, SearchQueryDto, SetRolePermissionsDto } from './dto/admin.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get() @RequirePermissions('settings:read')
  findAll() { return this.settings.findAll(); }

  @Get(':key') @RequirePermissions('settings:read')
  findOne(@Param('key') key: string) { return this.settings.findOne(key); }

  @Put(':key')
  @RequirePermissions('settings:update')
  @ApiOperation({ summary: 'Merge values into a settings pane, never replacing it' })
  save(@Param('key') key: string, @Body() dto: SaveSettingDto) {
    return this.settings.save(key, dto);
  }
}

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get() @RequirePermissions('roles:read')
  findAll() { return this.roles.findAll(); }

  @Put(':id/permissions')
  @RequirePermissions('roles:update')
  @ApiOperation({
    summary: 'Replace a role’s permissions',
    description: 'Any write permission implies read. Holders are forced to refresh their token.',
  })
  setPermissions(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRolePermissionsDto) {
    return this.roles.setPermissions(id, dto);
  }
}

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermissions('roles:read')
  @ApiOperation({ summary: 'The permission catalogue, grouped by module' })
  catalogue() { return this.roles.catalogue(); }
}

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'The audit trail — written by the server, not the client' })
  findAll(@Query() query: AuditQueryDto) { return this.audit.findAll(query); }
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Cross-module figures, computed once so they agree everywhere' })
  summary() { return this.reports.summary(); }

  @Get('approvals')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Everything waiting on a decision' })
  approvals() { return this.reports.approvals(); }

  @Get('my-work')
  @ApiOperation({ summary: 'Figures for the signed-in user’s own portal' })
  myWork() { return this.reports.myWork(); }
}

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Cross-entity search for the command palette' })
  search(@Query() query: SearchQueryDto) { return this.reports.search(query.q); }
}
