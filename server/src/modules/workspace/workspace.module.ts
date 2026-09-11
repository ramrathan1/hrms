import { Module } from '@nestjs/common';

import {
  NotificationsController, TodosController, UsersController,
} from './workspace.controller';
import { NotificationsService, TodosService, UsersService } from './workspace.service';
import { RealtimeModule } from '../realtime/realtime.module';

/**
 * Accounts, the notification bell and personal todos — the parts of the app
 * that belong to a person rather than to a business process.
 */
@Module({
  imports: [RealtimeModule],
  controllers: [UsersController, NotificationsController, TodosController],
  providers: [UsersService, NotificationsService, TodosService],
  exports: [NotificationsService],
})
export class WorkspaceModule {}
