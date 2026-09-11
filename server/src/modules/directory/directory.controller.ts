import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DepartmentsService, DesignationsService, EmployeesService } from './directory.service';
import {
  CreateDepartmentDto, CreateDesignationDto, CreateEmployeeDto, EmployeeQueryDto,
  UpdateDepartmentDto, UpdateDesignationDto, UpdateEmployeeDto,
} from './dto/directory.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get() @RequirePermissions('employees:read')
  findAll(@Query() query: EmployeeQueryDto) { return this.employees.findAll(query); }

  @Get('org-chart')
  @RequirePermissions('employees:read')
  @ApiOperation({ summary: 'Reporting tree, rooted at people with no manager' })
  orgChart() { return this.employees.orgChart(); }

  @Get(':id') @RequirePermissions('employees:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.employees.findOne(id); }

  @Post() @RequirePermissions('employees:create')
  create(@Body() dto: CreateEmployeeDto) { return this.employees.createEmployee(dto); }

  @Patch(':id') @RequirePermissions('employees:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.updateEmployee(id, dto);
  }

  @Delete(':id') @RequirePermissions('employees:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.employees.remove(id); }
}

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get() @RequirePermissions('departments:read')
  findAll(@Query() query: PaginationQueryDto) { return this.departments.findAll(query); }

  @Post() @RequirePermissions('departments:create')
  create(@Body() dto: CreateDepartmentDto) { return this.departments.createDepartment(dto); }

  @Patch(':id') @RequirePermissions('departments:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departments.update(id, { ...dto });
  }

  @Delete(':id')
  @RequirePermissions('departments:delete')
  @ApiOperation({ summary: 'Refused while employees are still in it' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.departments.remove(id); }
}

@ApiTags('Designations')
@ApiBearerAuth()
@Controller('designations')
export class DesignationsController {
  constructor(private readonly designations: DesignationsService) {}

  @Get() @RequirePermissions('employees:read')
  findAll(@Query() query: PaginationQueryDto) { return this.designations.findAll(query); }

  @Post() @RequirePermissions('employees:create')
  create(@Body() dto: CreateDesignationDto) { return this.designations.createDesignation(dto); }

  @Patch(':id') @RequirePermissions('employees:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDesignationDto) {
    return this.designations.update(id, { ...dto });
  }

  @Delete(':id') @RequirePermissions('employees:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.designations.remove(id); }
}
