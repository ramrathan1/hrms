import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  FloorsService, OfficeRoomsService, RecordingsService, TeamMeetingsService,
} from './office.service';
import {
  CreateFloorDto, CreateRecordingDto, CreateRoomDto, CreateTeamMeetingDto,
  RecordingQueryDto, TeamMeetingQueryDto, UpdateFloorDto, UpdateRoomDto,
  UpdateTeamMeetingDto,
} from './dto/office.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Floors')
@ApiBearerAuth()
@Controller('floors')
export class FloorsController {
  constructor(private readonly floors: FloorsService) {}

  @Get()
  @RequirePermissions('meetings:read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.floors.findAll(query);
  }

  @Post()
  @RequirePermissions('settings:update')
  create(@Body() dto: CreateFloorDto) {
    return this.floors.createFloor(dto);
  }

  @Patch(':id')
  @RequirePermissions('settings:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFloorDto) {
    return this.floors.updateFloor(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('settings:update')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.floors.remove(id);
  }
}

@ApiTags('Office rooms')
@ApiBearerAuth()
@Controller('office-rooms')
export class OfficeRoomsController {
  constructor(private readonly rooms: OfficeRoomsService) {}

  @Get()
  @RequirePermissions('meetings:read')
  @ApiOperation({ summary: 'Rooms with who is standing in them right now' })
  findAll() {
    return this.rooms.withOccupancy();
  }

  @Post()
  @RequirePermissions('settings:update')
  create(@Body() dto: CreateRoomDto) {
    return this.rooms.createRoom(dto);
  }

  @Patch(':id')
  @RequirePermissions('settings:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto) {
    return this.rooms.updateRoom(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('settings:update')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rooms.remove(id);
  }
}

@ApiTags('Team meetings')
@ApiBearerAuth()
@Controller('team-meetings')
export class TeamMeetingsController {
  constructor(private readonly meetings: TeamMeetingsService) {}

  @Get()
  @RequirePermissions('meetings:read')
  findAll(@Query() query: TeamMeetingQueryDto) {
    return this.meetings.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('meetings:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.findOne(id);
  }

  @Post()
  @RequirePermissions('meetings:create')
  @ApiOperation({ summary: 'Schedule a call; the room key is issued by the server' })
  create(@Body() dto: CreateTeamMeetingDto) {
    return this.meetings.schedule(dto);
  }

  @Patch(':id')
  @RequirePermissions('meetings:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTeamMeetingDto) {
    return this.meetings.updateMeeting(id, dto);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('meetings:update')
  end(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.end(id);
  }

  @Delete(':id')
  @RequirePermissions('meetings:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.remove(id);
  }
}

@ApiTags('Recordings')
@ApiBearerAuth()
@Controller('recordings')
export class RecordingsController {
  constructor(private readonly recordings: RecordingsService) {}

  @Get()
  @RequirePermissions('meetings:read')
  findAll(@Query() query: RecordingQueryDto) {
    return this.recordings.findAll(query);
  }

  @Post()
  @RequirePermissions('meetings:create')
  @ApiOperation({ summary: 'Register an uploaded file as a meeting recording' })
  create(@Body() dto: CreateRecordingDto) {
    return this.recordings.register(dto);
  }

  @Delete(':id')
  @RequirePermissions('meetings:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.recordings.remove(id);
  }
}
