import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');

  app.use(
    helmet({
      // Swagger UI needs inline styles; the API itself serves no HTML.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: config.get<string[]>('corsOrigins', []),
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Reject unknown fields outright rather than silently dropping them —
      // a typo in a client payload should be visible, not ignored.
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Worksuite API')
    .setDescription(
      'Modular monolith backing the Worksuite application. ' +
        'Every route below `/api/v1` requires a bearer access token unless marked otherwise, ' +
        'and every tenant-scoped query is filtered by the organization on that token.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addTag('Auth', 'Sign in, refresh, and the current profile')
    .addTag('Invoices', 'Invoicing and the payment ledger')
    .addTag('Payments', 'Payment reversal')
    .addTag('Clients', 'Client records, contacts and statements')
    .addTag('Leads', 'CRM leads and conversion')
    .addTag('Deals', 'Pipeline and deal movement')
    .addTag('Projects', 'Projects, members and financials')
    .addTag('Tasks', 'Task board and assignment')
    .addTag('Leave', 'Requests, entitlement and approval')
    .addTag('Attendance', 'Clock in/out and the monthly grid')
    .addTag('Jobs', 'Open roles and the hiring funnel')
    .addTag('Offers', 'Offers and acceptance')
    .addTag('Tickets', 'Support tickets and replies')
    .addTag('Letters', 'Templates, merge preview and issued letters')
    .addTag('Files', 'Uploads and downloads')
    .addTag('Mail', 'Mailbox, threads and sending')
    .addTag('Mail accounts', 'IMAP/SMTP connections')
    .addTag('Channels', 'Chat channels and membership')
    .addTag('Messages', 'Message reactions and edits')
    .addTag('Health', 'Liveness and dependency checks')
    .build();

  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
  });

  // Socket.IO clusters through Redis, so rooms work across instances.
  const ioAdapter = new RedisIoAdapter(app);
  await ioAdapter.connectToRedis();
  app.useWebSocketAdapter(ioAdapter);

  const port = config.get<number>('port', 3001);
  await app.listen(port);

  logger.log(`Worksuite API listening on http://localhost:${port}/api/v1`);
  logger.log(`API documentation at http://localhost:${port}/api`);
  logger.log(`Realtime gateway at ws://localhost:${port}/ws`);
}

void bootstrap();
