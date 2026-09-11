import { Module } from '@nestjs/common';

import { MailAccountsController, MailController } from './mail.controller';
import { MailAccountsService } from './mail-accounts.service';
import { MailMessagesService } from './mail-messages.service';
import { MailProcessor } from './mail.processor';

@Module({
  controllers: [MailAccountsController, MailController],
  // MailProcessor is a Bull consumer, not a controller — it runs on job events.
  providers: [MailAccountsService, MailMessagesService, MailProcessor],
  exports: [MailAccountsService, MailMessagesService],
})
export class MailModule {}
