import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import configuration, { validateEnv } from './config/configuration';
import { PrismaModule } from './infra/prisma/prisma.module';
import { TenantModule } from './infra/tenant/tenant.module';
import { TenantMiddleware } from './infra/tenant/tenant.middleware';
import { AppCacheModule } from './infra/cache/cache.module';
import { AppQueueModule } from './infra/queue/queue.module';
import { StorageModule } from './infra/storage/storage.module';
import { CryptoModule } from './infra/crypto/crypto.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CrmModule } from './modules/crm/crm.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PeopleOpsModule } from './modules/peopleops/peopleops.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { SupportModule } from './modules/support/support.module';
import { WorkplaceModule } from './modules/workplace/workplace.module';
import { FilesModule } from './modules/files/files.module';
import { MailModule } from './modules/mail/mail.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { AdminModule } from './modules/admin/admin.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { SalesModule } from './modules/sales/sales.module';
import { TreasuryModule } from './modules/treasury/treasury.module';
import { PeopleModule } from './modules/people/people.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { ItModule } from './modules/it/it.module';
import { OfficeModule } from './modules/office/office.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      cache: true,
    }),
    PrismaModule,
    TenantModule,
    AppCacheModule,
    AppQueueModule,
    StorageModule,
    CryptoModule,
    AuthModule,
    HealthModule,
    BillingModule,
    ClientsModule,
    CrmModule,
    ProjectsModule,
    PeopleOpsModule,
    RecruitmentModule,
    SupportModule,
    WorkplaceModule,
    FilesModule,
    MailModule,
    CollaborationModule,
    RealtimeModule,
    DirectoryModule,
    AdminModule,
    WorkspaceModule,
    SalesModule,
    TreasuryModule,
    PeopleModule,
    DeliveryModule,
    ItModule,
    OfficeModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: authenticate, then check role, then check permission.
    // Registering them globally means a new controller is protected by
    // default and has to opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Opens the AsyncLocalStorage scope for every route, including public ones.
    // path-to-regexp v8 requires a named wildcard.
    consumer.apply(TenantMiddleware).forRoutes('{*path}');
  }
}
