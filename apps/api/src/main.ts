import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { MeetinoIoAdapter } from './modules/realtime/socket-io.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService<AppConfig, true>);
  const port = config.get('port', { infer: true });
  const host = config.get('host', { infer: true });
  const webOrigin = config.get('cors', { infer: true }).webOrigin;
  const nodeEnv = config.get('nodeEnv', { infer: true });

  // Every route prefixed with /api so it sits cleanly behind nginx later.
  app.setGlobalPrefix('api');

  // Security headers. Default helmet is reasonable; we relax CSP only where
  // needed (Phase 5 when LiveKit WebSocket is added).
  app.use(helmet());

  // Refresh tokens travel in HTTP-only cookies (Phase 2).
  app.use(cookieParser());

  // Whitelisted CORS for the web client.
  app.enableCors({
    origin: webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Strict, automatic DTO validation everywhere.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Socket.IO adapter — required for the realtime gateway (Phase 4).
  // The custom adapter pulls CORS / ping settings from our typed config.
  app.useWebSocketAdapter(new MeetinoIoAdapter(app));

  // Graceful shutdown so Prisma/Redis hooks fire on SIGTERM.
  app.enableShutdownHooks();

  await app.listen(port, host);
  Logger.log(`Meetino API listening on http://${host}:${port}/api  (env=${nodeEnv})`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
