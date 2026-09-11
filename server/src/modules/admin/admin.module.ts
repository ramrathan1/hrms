import { Module } from '@nestjs/common';

import {
  AuditController, PermissionsController, ReportsController, RolesController,
  SearchController, SettingsController,
} from './admin.controller';
import { AuditService, ReportsService, RolesService, SettingsService } from './admin.service';

@Module({
  controllers: [
    SettingsController, RolesController, PermissionsController,
    AuditController, ReportsController, SearchController,
  ],
  providers: [SettingsService, RolesService, AuditService, ReportsService],
  exports: [ReportsService],
})
export class AdminModule {}
