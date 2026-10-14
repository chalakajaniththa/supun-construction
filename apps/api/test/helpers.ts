import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE } from '../src/common/auth/auth.constants.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { seedBase } from '../src/seed/base.js';

export const ADMIN = { username: 'admin', password: 'admin123' };

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
}

/** Boots the whole API (real DB + real storage) for a test file. */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication>({ logger: ['error', 'warn'] });
  configureApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  return { app, prisma, http: () => request(app.getHttpServer()) };
}

/** Empties every table (keeps the migrations table) and re-runs the base seed. */
export async function resetDb(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  await seedBase(prisma, { adminUsername: ADMIN.username, adminPassword: ADMIN.password });
}

/** Logs in and returns the `Cookie` header value for later requests. */
export async function loginCookie(
  ctx: TestContext,
  credentials: { username: string; password: string } = ADMIN,
): Promise<string> {
  const res = await ctx.http().post('/auth/login').send(credentials).expect(200);
  const setCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const session = setCookie.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!session) throw new Error('No session cookie in login response');
  return session.split(';')[0]!;
}
