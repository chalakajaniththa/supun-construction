import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';

/** Shared HTTP setup for main.ts and the e2e tests. */
export function configureApp(app: INestApplication): void {
  const express = app as NestExpressApplication;
  // Requests arrive through the Next.js rewrite proxy; trust it for req.ip (login rate limit).
  express.set('trust proxy', 'loopback, linklocal, uniquelocal');
  express.disable('x-powered-by');
  // Security headers. No CSP here: the API serves JSON and stored files (PDF previews in an
  // iframe would be blocked by a strict policy); the web app sets the page headers.
  app.use(
    helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-origin' } }),
  );
  // BOQ imports send up to 1,000 rows as JSON.
  express.useBodyParser('json', { limit: '2mb' });
  app.use(cookieParser());
  app.enableShutdownHooks();
}
