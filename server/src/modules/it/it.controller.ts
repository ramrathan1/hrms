import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  BioLinksService, BiometricDevicesService, BiometricPunchesService, DomainsService,
  HostingsService, QrCodesService, WebhooksService,
} from './it.service';
import {
  CreateBioLinkDto, CreateDeviceDto, CreateDomainDto, CreateHostingDto, CreatePunchDto,
  CreateQrCodeDto, CreateWebhookDto, ExpiryQueryDto, PunchQueryDto, UpdateBioLinkDto,
  UpdateDeviceDto, UpdateDomainDto, UpdateHostingDto, UpdateQrCodeDto, UpdateWebhookDto,
} from './dto/it.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Bio links')
@ApiBearerAuth()
@Controller('bio-links')
export class BioLinksController {
  constructor(private readonly links: BioLinksService) {}

  @Get()
  @RequirePermissions('assets:read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.links.findAll(query);
  }

  @Post()
  @RequirePermissions('assets:create')
  create(@Body() dto: CreateBioLinkDto) {
    return this.links.createLink(dto);
  }

  @Patch(':id')
  @RequirePermissions('assets:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBioLinkDto) {
    return this.links.updateLink(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('assets:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.links.remove(id);
  }
}

@ApiTags('QR codes')
@ApiBearerAuth()
@Controller('qr-codes')
export class QrCodesController {
  constructor(private readonly codes: QrCodesService) {}

  @Get()
  @RequirePermissions('assets:read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.codes.findAll(query);
  }

  @Post()
  @RequirePermissions('assets:create')
  create(@Body() dto: CreateQrCodeDto) {
    return this.codes.createCode(dto);
  }

  @Patch(':id')
  @RequirePermissions('assets:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateQrCodeDto) {
    return this.codes.updateCode(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('assets:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.codes.remove(id);
  }
}

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  @RequirePermissions('settings:read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.webhooks.findAll(query);
  }

  @Post()
  @RequirePermissions('settings:create')
  create(@Body() dto: CreateWebhookDto) {
    return this.webhooks.createWebhook(dto);
  }

  @Patch(':id')
  @RequirePermissions('settings:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooks.updateWebhook(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('settings:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.webhooks.remove(id);
  }
}

@ApiTags('Hosting')
@ApiBearerAuth()
@Controller('hostings')
export class HostingsController {
  constructor(private readonly hostings: HostingsService) {}

  @Get()
  @RequirePermissions('assets:read')
  findAll(@Query() query: ExpiryQueryDto) {
    return this.hostings.findAll(query);
  }

  @Post()
  @RequirePermissions('assets:create')
  create(@Body() dto: CreateHostingDto) {
    return this.hostings.createHosting(dto);
  }

  @Patch(':id')
  @RequirePermissions('assets:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHostingDto) {
    return this.hostings.updateHosting(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('assets:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.hostings.remove(id);
  }
}

@ApiTags('Domains')
@ApiBearerAuth()
@Controller('domains')
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  @RequirePermissions('assets:read')
  findAll(@Query() query: ExpiryQueryDto) {
    return this.domains.findAll(query);
  }

  @Get('expiring')
  @RequirePermissions('assets:read')
  @ApiOperation({ summary: 'Domains and hosting lapsing soon, soonest first' })
  expiring() {
    return this.domains.expiring();
  }

  @Post()
  @RequirePermissions('assets:create')
  create(@Body() dto: CreateDomainDto) {
    return this.domains.createDomain(dto);
  }

  @Patch(':id')
  @RequirePermissions('assets:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDomainDto) {
    return this.domains.updateDomain(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('assets:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.domains.remove(id);
  }
}

@ApiTags('Biometric devices')
@ApiBearerAuth()
@Controller('biometric-devices')
export class BiometricDevicesController {
  constructor(private readonly devices: BiometricDevicesService) {}

  /* Door readers are security equipment, not the attendance board: managing
     them needs more than the `attendance:read` everyone has. */
  @Get()
  @RequirePermissions('attendance:update')
  findAll(@Query() query: PaginationQueryDto) {
    return this.devices.findAll(query);
  }

  @Post()
  @RequirePermissions('attendance:create')
  create(@Body() dto: CreateDeviceDto) {
    return this.devices.createDevice(dto);
  }

  @Patch(':id')
  @RequirePermissions('attendance:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeviceDto) {
    return this.devices.updateDevice(id, dto);
  }

  @Post(':id/sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('attendance:update')
  @ApiOperation({ summary: 'Mark the device as having just checked in' })
  sync(@Param('id', ParseUUIDPipe) id: string) {
    return this.devices.sync(id);
  }

  @Delete(':id')
  @RequirePermissions('attendance:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.devices.remove(id);
  }
}

@ApiTags('Biometric punches')
@ApiBearerAuth()
@Controller('biometric-punches')
export class BiometricPunchesController {
  constructor(private readonly punches: BiometricPunchesService) {}

  /* Who walked through which door and when is a security log — a good deal
     more revealing than the monthly attendance grid, and not something every
     colleague should be able to page through. */
  @Get()
  @RequirePermissions('attendance:update')
  @ApiOperation({ summary: 'Raw device reads. Attendance records stay authoritative.' })
  findAll(@Query() query: PunchQueryDto) {
    return this.punches.findAll(query);
  }

  @Post()
  @RequirePermissions('attendance:create')
  create(@Body() dto: CreatePunchDto) {
    return this.punches.record(dto);
  }

  @Delete(':id')
  @RequirePermissions('attendance:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.punches.remove(id);
  }
}
