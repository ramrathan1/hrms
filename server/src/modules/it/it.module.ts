import { Module } from '@nestjs/common';

import {
  BioLinksController, BiometricDevicesController, BiometricPunchesController,
  DomainsController, HostingsController, QrCodesController, WebhooksController,
} from './it.controller';
import {
  BioLinksService, BiometricDevicesService, BiometricPunchesService, DomainsService,
  HostingsService, QrCodesService, WebhooksService,
} from './it.service';

/** The digital estate: links, codes, integrations, hosting and door readers. */
@Module({
  controllers: [
    BioLinksController,
    QrCodesController,
    WebhooksController,
    HostingsController,
    DomainsController,
    BiometricDevicesController,
    BiometricPunchesController,
  ],
  providers: [
    BioLinksService,
    QrCodesService,
    WebhooksService,
    HostingsService,
    DomainsService,
    BiometricDevicesService,
    BiometricPunchesService,
  ],
})
export class ItModule {}
