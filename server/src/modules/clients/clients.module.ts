import { Module } from '@nestjs/common';
import { ClientsController, ClientContactsController } from './clients.controller';
import { ClientsService, ClientContactsService } from './clients.service';

@Module({
  controllers: [ClientsController, ClientContactsController],
  providers: [ClientsService, ClientContactsService],
  exports: [ClientsService, ClientContactsService],
})
export class ClientsModule {}
