import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AttendanceService } from './attendance.service';
import { LeaveService } from './leave.service';
import { HolidaysService, LeaveTypesService, ShiftsService } from './peopleops.service';
import {
  AttendanceQueryDto, BalanceQueryDto, ClockDto, CreateHolidayDto, CreateLeaveDto,
  CreateLeaveTypeDto, CreateShiftDto, DecideLeaveDto, LeaveQueryDto, MarkAttendanceDto,
  MonthlyGridQueryDto, UpdateHolidayDto, UpdateLeaveTypeDto, UpdateShiftDto,
} from './dto/peopleops.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { requireTenantContext } from '../../infra/tenant/tenant-context';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Leave')
@ApiBearerAuth()
@Controller('leave')
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get() @RequirePermissions('leave:read')
  findAll(@Query() query: LeaveQueryDto) { return this.leave.findAll(query); }

  @Get('balances')
  @RequirePermissions('leave:read')
  @ApiOperation({ summary: 'Entitlement per type — quota, used, pending, remaining' })
  async balances(@Query() query: BalanceQueryDto) {
    const ctx = requireTenantContext();
    const canSeeEveryone =
      ctx.permissions.includes('*') ||
      ctx.permissions.includes('leave:approve') ||
      ctx.permissions.includes('leave:*');

    // Somebody's entitlement is their business. Without approval rights you
    // get your own, whatever the query string asks for.
    if (!canSeeEveryone) {
      const own = await this.leave.employeeIdForUser(ctx.userId);
      return own ? this.leave.balances(own, query.year) : [];
    }

    // No employee named: the whole company, which is what the HR screen wants.
    return query.employeeId
      ? this.leave.balances(query.employeeId, query.year)
      : this.leave.allBalances(query.year);
  }

  @Get('out-today')
  @RequirePermissions('leave:read')
  @ApiOperation({
    summary: 'Who is on approved leave today',
    description:
      'Names and dates only — no reason and no leave type. Anyone may see that ' +
      'a colleague is off work; why they are off is between them and HR.',
  })
  outToday(@Query('on') on?: string) { return this.leave.outToday(on); }

  @Get(':id') @RequirePermissions('leave:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.leave.findOne(id); }

  @Post()
  @RequirePermissions('leave:create')
  @ApiOperation({
    summary: 'Request leave',
    description:
      'Days are counted server-side and checked against the balance under a row lock. ' +
      'Rejected for insufficient entitlement or an overlapping request.',
  })
  request(@Body() dto: CreateLeaveDto) { return this.leave.request(dto); }

  @Post(':id/decide')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('leave:approve')
  @ApiOperation({ summary: 'Approve or reject; moves the days from pending to used' })
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveDto) {
    return this.leave.decide(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('leave:delete')
  @ApiOperation({ summary: 'Cancel a pending request and release the hold' })
  cancel(@Param('id', ParseUUIDPipe) id: string) { return this.leave.cancel(id); }
}

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get() @RequirePermissions('attendance:read')
  findAll(@Query() query: AttendanceQueryDto) { return this.attendance.findAll(query); }

  @Get('today')
  @RequirePermissions('attendance:clock')
  @ApiOperation({ summary: "Today's record for the signed-in user" })
  today(@Query('employeeId') employeeId?: string) { return this.attendance.today(employeeId); }

  @Get('grid')
  @RequirePermissions('attendance:read')
  @ApiOperation({
    summary: 'Monthly grid',
    description:
      'One row per employee, one cell per day. Days with no record resolve to weekend, ' +
      'holiday or approved leave before they count as absent.',
  })
  grid(@Query() query: MonthlyGridQueryDto) { return this.attendance.monthlyGrid(query); }

  @Post('clock-in')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('attendance:clock')
  @ApiOperation({ summary: 'Clock in; idempotent per employee per day' })
  clockIn(@Body() dto: ClockDto) { return this.attendance.clockIn(dto); }

  @Post('clock-out')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('attendance:clock')
  clockOut(@Body() dto: ClockDto) { return this.attendance.clockOut(dto); }

  @Post('mark')
  @RequirePermissions('attendance:update')
  @ApiOperation({ summary: 'HR correction to the record; always audited' })
  mark(@Body() dto: MarkAttendanceDto) { return this.attendance.mark(dto); }
}

@ApiTags('Leave types')
@ApiBearerAuth()
@Controller('leave-types')
export class LeaveTypesController {
  constructor(private readonly types: LeaveTypesService) {}

  @Get() @RequirePermissions('leave:read')
  findAll(@Query() query: PaginationQueryDto) { return this.types.findAll(query); }

  @Post() @RequirePermissions('leave:create')
  create(@Body() dto: CreateLeaveTypeDto) { return this.types.createType(dto); }

  @Patch(':id') @RequirePermissions('leave:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.types.updateType(id, dto);
  }

  @Delete(':id') @RequirePermissions('leave:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.types.remove(id); }
}

@ApiTags('Shifts')
@ApiBearerAuth()
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get() @RequirePermissions('attendance:read')
  findAll(@Query() query: PaginationQueryDto) { return this.shifts.findAll(query); }

  @Post() @RequirePermissions('attendance:create')
  create(@Body() dto: CreateShiftDto) { return this.shifts.create({ ...dto }); }

  @Patch(':id') @RequirePermissions('attendance:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShiftDto) {
    return this.shifts.update(id, { ...dto });
  }

  @Delete(':id') @RequirePermissions('attendance:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.shifts.remove(id); }
}

@ApiTags('Holidays')
@ApiBearerAuth()
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get() @RequirePermissions('attendance:read')
  findAll(@Query() query: PaginationQueryDto) { return this.holidays.findAll(query); }

  @Post() @RequirePermissions('attendance:create')
  create(@Body() dto: CreateHolidayDto) { return this.holidays.createHoliday(dto); }

  @Patch(':id') @RequirePermissions('attendance:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHolidayDto) {
    return this.holidays.updateHoliday(id, dto);
  }

  @Delete(':id') @RequirePermissions('attendance:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.holidays.remove(id); }
}
