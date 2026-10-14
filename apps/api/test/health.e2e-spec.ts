import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestContext, createTestApp, resetDb } from './helpers.js';

describe('GET /health', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('is public and reports db + storage', async () => {
    const res = await ctx.http().get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok', storage: 'ok' });
  });
});
