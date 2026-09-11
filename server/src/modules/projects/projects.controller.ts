import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { MilestonesService, ProjectsService, TasksService, TimeLogsService } from './projects.service';
import {
  CreateMilestoneDto, CreateProjectDto, CreateTaskDto, CreateTimeLogDto, MoveTaskDto,
  ProjectQueryDto, SetMembersDto, TaskQueryDto, TimeLogQueryDto, TimesheetQueryDto,
  UpdateMilestoneDto, UpdateProjectDto, UpdateTaskDto,
} from './dto/project.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get() @RequirePermissions('projects:read')
  findAll(@Query() query: ProjectQueryDto) { return this.projects.findAll(query); }

  @Get(':id') @RequirePermissions('projects:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.projects.findOne(id); }

  @Get(':id/financials')
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: 'Budget burn — labour at each rate, plus approved expenses' })
  financials(@Param('id', ParseUUIDPipe) id: string) { return this.projects.financials(id); }

  @Post() @RequirePermissions('projects:create')
  create(@Body() dto: CreateProjectDto) { return this.projects.createProject(dto); }

  @Patch(':id') @RequirePermissions('projects:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.updateProject(id, dto);
  }

  @Put(':id/members')
  @RequirePermissions('projects:update')
  @ApiOperation({ summary: 'Replace the project team' })
  setMembers(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetMembersDto) {
    return this.projects.setMembers(id, dto.userIds);
  }

  @Delete(':id') @RequirePermissions('projects:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.projects.remove(id); }
}

@ApiTags('Milestones')
@ApiBearerAuth()
@Controller('milestones')
export class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get() @RequirePermissions('milestones:read')
  findAll(@Query() query: ProjectQueryDto) { return this.milestones.findAll(query); }

  @Post() @RequirePermissions('milestones:create')
  create(@Body() dto: CreateMilestoneDto) { return this.milestones.createMilestone(dto); }

  @Patch(':id') @RequirePermissions('milestones:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMilestoneDto) {
    return this.milestones.updateMilestone(id, dto);
  }

  @Delete(':id') @RequirePermissions('milestones:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.milestones.remove(id); }
}

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get() @RequirePermissions('tasks:read')
  findAll(@Query() query: TaskQueryDto) { return this.tasks.findAll(query); }

  @Get(':id') @RequirePermissions('tasks:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.tasks.findOne(id); }

  @Post() @RequirePermissions('tasks:create')
  @ApiOperation({ summary: 'Create a task; may carry a chat or meeting as its source' })
  create(@Body() dto: CreateTaskDto) { return this.tasks.createTask(dto); }

  @Patch(':id') @RequirePermissions('tasks:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.updateTask(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('tasks:update')
  @ApiOperation({ summary: 'Board move; recomputes the project’s progress' })
  move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveTaskDto) {
    return this.tasks.moveStatus(id, dto.status);
  }

  @Delete(':id') @RequirePermissions('tasks:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.tasks.remove(id); }
}

@ApiTags('Time logs')
@ApiBearerAuth()
@Controller('time-logs')
export class TimeLogsController {
  constructor(private readonly timeLogs: TimeLogsService) {}

  @Get() @RequirePermissions('timelogs:read')
  findAll(@Query() query: TimeLogQueryDto) { return this.timeLogs.findAll(query); }

  @Get('timesheet')
  @RequirePermissions('timelogs:read')
  @ApiOperation({ summary: 'Hours and value per employee for a period' })
  timesheet(@Query() query: TimesheetQueryDto) {
    return this.timeLogs.timesheet(query.from, query.to, query.employeeId);
  }

  @Post() @RequirePermissions('timelogs:create')
  create(@Body() dto: CreateTimeLogDto) { return this.timeLogs.createTimeLog(dto); }

  @Delete(':id') @RequirePermissions('timelogs:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.timeLogs.remove(id); }
}
