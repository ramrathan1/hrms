import { Module } from '@nestjs/common';

import {
  MilestonesController, ProjectsController, TasksController, TimeLogsController,
} from './projects.controller';
import {
  MilestonesService, ProjectsService, TasksService, TimeLogsService,
} from './projects.service';

@Module({
  controllers: [ProjectsController, MilestonesController, TasksController, TimeLogsController],
  providers: [ProjectsService, MilestonesService, TasksService, TimeLogsService],
  exports: [ProjectsService, TasksService],
})
export class ProjectsModule {}
