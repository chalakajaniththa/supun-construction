import { DEFAULT_SETTINGS } from '@sc/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestContext, createTestApp, loginCookie, resetDb } from './helpers.js';

describe('settings', () => {
  let ctx: TestContext;
  let cookie: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.prisma);
    cookie = await loginCookie(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /settings returns every key with defaults', async () => {
    const res = await ctx.http().get('/settings').set('Cookie', cookie).expect(200);
    expect(res.body).toEqual(DEFAULT_SETTINGS);
  });

  it('PATCH merges and validates per key', async () => {
    const res = await ctx
      .http()
      .patch('/settings/payroll')
      .set('Cookie', cookie)
      .send({ epfEmployeePct: '8.5', workingDaysPerMonth: 25 })
      .expect(200);
    expect(res.body).toEqual({
      ...DEFAULT_SETTINGS.payroll,
      epfEmployeePct: '8.5',
      workingDaysPerMonth: 25,
    });

    const all = await ctx.http().get('/settings').set('Cookie', cookie).expect(200);
    expect(all.body.payroll.epfEmployeePct).toBe('8.5');
  });

  it('PATCH company info', async () => {
    const res = await ctx
      .http()
      .patch('/settings/company')
      .set('Cookie', cookie)
      .send({
        name: 'Supun Construction (Pvt) Ltd',
        phone: '027 222 3456',
        email: 'info@example.com',
      })
      .expect(200);
    expect(res.body.name).toBe('Supun Construction (Pvt) Ltd');
    expect(res.body.address).toBe('');
  });

  it.each([
    ['payroll', { epfEmployeePct: '150' }],
    ['payroll', { otMultiplier: 'abc' }],
    ['payroll', { workingDaysPerMonth: 0 }],
    ['reminders', { daysBefore: [] }],
    ['billing', { defaultRetentionPct: '-1' }],
    ['company', { name: '' }],
    ['company', { email: 'not-an-email' }],
  ])('rejects invalid %s %j with 400', async (key, body) => {
    const res = await ctx
      .http()
      .patch(`/settings/${key}`)
      .set('Cookie', cookie)
      .send(body)
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('rejects an unknown key with 404 UNKNOWN_SETTING', async () => {
    const res = await ctx.http().patch('/settings/nope').set('Cookie', cookie).send({}).expect(404);
    expect(res.body.code).toBe('UNKNOWN_SETTING');
  });

  it('writes an audit log row on PATCH, readable via GET /audit', async () => {
    await ctx
      .http()
      .patch('/settings/reminders')
      .set('Cookie', cookie)
      .send({ daysBefore: [60, 30] })
      .expect(200);
    const res = await ctx
      .http()
      .get('/audit')
      .query({ entity: 'Setting', entityId: 'reminders' })
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      entity: 'Setting',
      entityId: 'reminders',
      action: 'UPDATE',
      username: 'admin',
    });
    expect(res.body.items[0].summary.body).toEqual({ daysBefore: [60, 30] });
  });

  it('does not audit failed requests or reads', async () => {
    const before = await ctx.prisma.auditLog.count();
    await ctx
      .http()
      .patch('/settings/billing')
      .set('Cookie', cookie)
      .send({ defaultRetentionPct: 'x' });
    await ctx.http().get('/settings').set('Cookie', cookie);
    expect(await ctx.prisma.auditLog.count()).toBe(before);
  });

  it('GET /audit paginates', async () => {
    for (let i = 0; i < 3; i++) {
      await ctx
        .http()
        .patch('/settings/billing')
        .set('Cookie', cookie)
        .send({ defaultRetentionPct: String(5 + i) })
        .expect(200);
    }
    const res = await ctx
      .http()
      .get('/audit')
      .query({ entity: 'Setting', page: 1, pageSize: 2 })
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBeGreaterThanOrEqual(4);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(2);
    await ctx.http().get('/audit').query({ pageSize: 1000 }).set('Cookie', cookie).expect(400);
  });
});
