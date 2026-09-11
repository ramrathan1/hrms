import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  AppreciationsService, AwardsService, EmergencyContactsService, EmployeeDocumentsService,
  KeyResultsService, ObjectivesService, OvertimeService, PayslipsService,
  ReviewMeetingsService, SalariesService, SalaryChangesService,
} from './people.service';
import {
  AppreciationQueryDto, CreateAppreciationDto, CreateAwardDto, CreateEmergencyContactDto,
  CreateEmployeeDocumentDto, CreateKeyResultDto, CreateObjectiveDto, CreateOvertimeDto,
  CreatePayslipDto, CreateReviewMeetingDto, CreateSalaryDto, DecideDto,
  EmployeeScopedQueryDto, OvertimeQueryDto, PayslipQueryDto, ReviewMeetingQueryDto,
  SalaryQueryDto, UpdateAwardDto, UpdateEmergencyContactDto, UpdateKeyResultDto,
  UpdateObjectiveDto, UpdateOvertimeDto, UpdateReviewMeetingDto,
} from './dto/people.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Salaries')
@ApiBearerAuth()
@Controller('salaries')
export class SalariesController {
  constructor(
    private readonly salaries: SalariesService,
    private readonly changes: SalaryChangesService,
  ) {}

  @Get()
  @RequirePermissions('payroll:read')
  findAll(@Query() query: SalaryQueryDto) {
    return this.salaries.findAll(query);
  }

  @Get('current')
  @RequirePermissions('payroll:read')
  @ApiOperation({ summary: 'The salary in force for each employee today' })
  current() {
    return this.salaries.current();
  }

  @Get('history')
  @RequirePermissions('payroll:read')
  @ApiOperation({ summary: 'Every raise and cut, newest first' })
  history(@Query() query: EmployeeScopedQueryDto) {
    return this.changes.findAll(query);
  }

  @Post()
  @RequirePermissions('payroll:create')
  @ApiOperation({
    summary: 'Set a new salary',
    description: 'Closes the previous band and records the change, rather than overwriting it.',
  })
  create(@Body() dto: CreateSalaryDto) {
    return this.salaries.setSalary(dto);
  }
}

@ApiTags('Payslips')
@ApiBearerAuth()
@Controller('payslips')
export class PayslipsController {
  constructor(private readonly payslips: PayslipsService) {}

  @Get()
  @RequirePermissions('payroll:read')
  findAll(@Query() query: PayslipQueryDto) {
    return this.payslips.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('payroll:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.payslips.findOne(id);
  }

  @Post()
  @RequirePermissions('payroll:create')
  @ApiOperation({ summary: 'Draft a payslip; gross comes from the salary on record' })
  create(@Body() dto: CreatePayslipDto) {
    return this.payslips.draft(dto);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('payroll:update')
  pay(@Param('id', ParseUUIDPipe) id: string) {
    return this.payslips.markPaid(id);
  }

  @Delete(':id')
  @RequirePermissions('payroll:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.payslips.remove(id);
  }
}

@ApiTags('Overtime')
@ApiBearerAuth()
@Controller('overtime')
export class OvertimeController {
  constructor(private readonly overtime: OvertimeService) {}

  @Get()
  @RequirePermissions('attendance:read')
  findAll(@Query() query: OvertimeQueryDto) {
    return this.overtime.findAll(query);
  }

  @Post()
  @RequirePermissions('attendance:clock')
  create(@Body() dto: CreateOvertimeDto) {
    return this.overtime.createRequest(dto);
  }

  @Patch(':id')
  @RequirePermissions('attendance:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOvertimeDto) {
    return this.overtime.updateRequest(id, dto);
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('leave:approve')
  @ApiOperation({ summary: 'Approve or reject. You cannot decide your own.' })
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideDto) {
    return this.overtime.decide(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('attendance:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.overtime.remove(id);
  }
}

@ApiTags('Objectives')
@ApiBearerAuth()
@Controller('objectives')
export class ObjectivesController {
  constructor(private readonly objectives: ObjectivesService) {}

  @Get()
  @RequirePermissions('performance:read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.objectives.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('performance:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.objectives.findOne(id);
  }

  @Post()
  @RequirePermissions('performance:create')
  create(@Body() dto: CreateObjectiveDto) {
    return this.objectives.createObjective(dto);
  }

  @Patch(':id')
  @RequirePermissions('performance:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateObjectiveDto) {
    return this.objectives.updateObjective(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('performance:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.objectives.remove(id);
  }
}

@ApiTags('Key results')
@ApiBearerAuth()
@Controller('key-results')
export class KeyResultsController {
  constructor(private readonly results: KeyResultsService) {}

  @Get()
  @RequirePermissions('performance:read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.results.findAll(query);
  }

  @Post()
  @RequirePermissions('performance:create')
  @ApiOperation({ summary: 'Add a key result; the objective\'s progress is recomputed' })
  create(@Body() dto: CreateKeyResultDto) {
    return this.results.createResult(dto);
  }

  @Patch(':id')
  @RequirePermissions('performance:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateKeyResultDto) {
    return this.results.updateResult(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('performance:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.results.remove(id);
  }
}

@ApiTags('Review meetings')
@ApiBearerAuth()
@Controller('review-meetings')
export class ReviewMeetingsController {
  constructor(private readonly meetings: ReviewMeetingsService) {}

  @Get()
  @RequirePermissions('performance:read')
  findAll(@Query() query: ReviewMeetingQueryDto) {
    return this.meetings.findAll(query);
  }

  @Post()
  @RequirePermissions('performance:create')
  create(@Body() dto: CreateReviewMeetingDto) {
    return this.meetings.schedule(dto);
  }

  @Patch(':id')
  @RequirePermissions('performance:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReviewMeetingDto) {
    return this.meetings.updateMeeting(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('performance:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.remove(id);
  }
}

@ApiTags('Awards')
@ApiBearerAuth()
@Controller('awards')
export class AwardsController {
  constructor(private readonly awards: AwardsService) {}

  @Get()
  @RequirePermissions('performance:read')
  findAll(@Query() query: PaginationQueryDto) {
    return this.awards.findAll(query);
  }

  @Post()
  @RequirePermissions('performance:create')
  create(@Body() dto: CreateAwardDto) {
    return this.awards.createAward(dto);
  }

  @Patch(':id')
  @RequirePermissions('performance:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAwardDto) {
    return this.awards.updateAward(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('performance:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.awards.remove(id);
  }
}

@ApiTags('Appreciations')
@ApiBearerAuth()
@Controller('appreciations')
export class AppreciationsController {
  constructor(private readonly appreciations: AppreciationsService) {}

  @Get()
  @RequirePermissions('performance:read')
  findAll(@Query() query: AppreciationQueryDto) {
    return this.appreciations.findAll(query);
  }

  @Post()
  @RequirePermissions('performance:create')
  @ApiOperation({ summary: 'Give someone an award' })
  create(@Body() dto: CreateAppreciationDto) {
    return this.appreciations.give(dto);
  }

  @Delete(':id')
  @RequirePermissions('performance:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.appreciations.remove(id);
  }
}

@ApiTags('Emergency contacts')
@ApiBearerAuth()
@Controller('emergency-contacts')
export class EmergencyContactsController {
  constructor(private readonly contacts: EmergencyContactsService) {}

  @Get()
  @RequirePermissions('employees:read')
  findAll(@Query() query: EmployeeScopedQueryDto) {
    return this.contacts.findAll(query);
  }

  @Post()
  @RequirePermissions('employees:update')
  create(@Body() dto: CreateEmergencyContactDto) {
    return this.contacts.createContact(dto);
  }

  @Patch(':id')
  @RequirePermissions('employees:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmergencyContactDto) {
    return this.contacts.updateContact(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('employees:update')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.remove(id);
  }
}

@ApiTags('Employee documents')
@ApiBearerAuth()
@Controller('employee-documents')
export class EmployeeDocumentsController {
  constructor(private readonly documents: EmployeeDocumentsService) {}

  @Get()
  @RequirePermissions('employees:read')
  findAll(@Query() query: EmployeeScopedQueryDto) {
    return this.documents.findAll(query);
  }

  @Post()
  @RequirePermissions('employees:update')
  @ApiOperation({ summary: 'Attach a document to an employee file' })
  create(@Body() dto: CreateEmployeeDocumentDto) {
    return this.documents.addDocument(dto);
  }

  @Delete(':id')
  @RequirePermissions('employees:update')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.remove(id);
  }
}
