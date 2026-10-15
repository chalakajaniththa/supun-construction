import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';

/** Shared HTTP setup for main.ts and the e2e tests. */
export function configureApp(app: INestApplication): void {
  const express = app as NestExpressApplication;
  // Requests arrive through the Next.js rewrite proxy; trust it for req.ip (login rate limit).
  express.set('trust proxy', 'loopback, linklocal, uniquelocal');
  express.disable('x-powered-by');
  // BOQ imports send up to 1,000 rows as JSON.
  express.useBodyParser('json', { limit: '2mb' });
  app.use(cookieParser());
  app.enableShutdownHooks();
}
