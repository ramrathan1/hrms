import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { NotificationsService, TodosService, UsersService } from './workspace.service';
import {
  CreateTodoDto, CreateUserDto, NotificationQueryDto, NotifyDto, UpdateTodoDto,
  UpdateUserDto, UserQueryDto,
} from './dto/workspace.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users:read')
  findAll(@Query() query: UserQueryDto) {
    return this.users.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('users:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id);
  }

  @Post()
  @RequirePermissions('users:create')
  @ApiOperation({ summary: 'Invite a user. They start INVITED with the password you set.' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('users:update')
  @ApiOperation({ summary: 'Update profile, roles, status or password. Role and password changes end existing sessions.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users:delete')
  @ApiOperation({ summary: 'Suspend the account and revoke its sessions. History is kept.' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.deactivate(id);
  }
}

/** Your own bell. Every route here is scoped to the signed-in user. */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findAll(@Query() query: NotificationQueryDto) {
    return this.notifications.findAll(query);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead() {
    return this.notifications.markAllRead();
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  markRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.remove(id);
  }

  @Post()
  @RequirePermissions('notices:create')
  @ApiOperation({ summary: 'Raise a notification for someone else' })
  notify(@Body() dto: NotifyDto) {
    return this.notifications.notify(dto);
  }
}

@ApiTags('Todos')
@ApiBearerAuth()
@Controller('todos')
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.todos.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateTodoDto) {
    return this.todos.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTodoDto) {
    return this.todos.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.todos.remove(id);
  }
}
