import { Module } from '@nestjs/common';

import {
  DepartmentsController, DesignationsController, EmployeesController,
} from './directory.controller';
import { DepartmentsService, DesignationsService, EmployeesService } from './directory.service';

@Module({
  controllers: [EmployeesController, DepartmentsController, DesignationsController],
  providers: [EmployeesService, DepartmentsService, DesignationsService],
  exports: [EmployeesService],
})
export class DirectoryModule {}
