import { Global, Module } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';

@Global()
@Module({
  providers: [TenantMiddleware],
  exports: [TenantMiddleware],
})
export class TenantModule {}
