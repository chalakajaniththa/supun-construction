import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, type TestContext, createTestApp, loginCookie, resetDb } from './helpers.js';

describe('auth', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('logs in with the seeded admin and sets an httpOnly SameSite=Lax cookie', async () => {
    const res = await ctx.http().post('/auth/login').send(ADMIN).expect(200);
    expect(res.body).toMatchObject({
      username: 'admin',
      mustChangePassword: false,
      usingDefaultPassword: true,
    });
    expect(res.body.passwordHash).toBeUndefined();
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
    expect(cookie).toMatch(/sc_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Secure/);
  });

  it('rejects a wrong password with 401 INVALID_CREDENTIALS', async () => {
    const res = await ctx
      .http()
      .post('/auth/login')
      .send({ username: 'admin', password: 'wrong-password' })
      .expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('rejects an unknown user with the same error', async () => {
    const res = await ctx
      .http()
      .post('/auth/login')
      .send({ username: 'nobody', password: 'admin123' })
      .expect(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('validates the login body', async () => {
    const res = await ctx.http().post('/auth/login').send({ username: '' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('returns 401 on a protected route without the cookie', async () => {
    const res = await ctx.http().get('/auth/me').expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
    await ctx.http().get('/settings').expect(401);
    await ctx.http().get('/audit').expect(401);
  });

  it('returns 401 with a forged cookie', async () => {
    await ctx.http().get('/auth/me').set('Cookie', 'sc_session=not-a-jwt').expect(401);
  });

  it('GET /auth/me returns the current user', async () => {
    const cookie = await loginCookie(ctx);
    const res = await ctx.http().get('/auth/me').set('Cookie', cookie).expect(200);
    expect(res.body.username).toBe('admin');
    expect(res.body.lastLoginAt).toBeTruthy();
  });

  it('logout clears the cookie', async () => {
    const res = await ctx.http().post('/auth/logout').expect(200);
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
    expect(cookie).toMatch(/sc_session=;/);
  });

  it('changes the password', async () => {
    const cookie = await loginCookie(ctx);
    const wrong = await ctx
      .http()
      .post('/auth/change-password')
      .set('Cookie', cookie)
      .send({
        currentPassword: 'nope',
        newPassword: 'new-secret-1',
        confirmPassword: 'new-secret-1',
      })
      .expect(400);
    expect(wrong.body.code).toBe('WRONG_PASSWORD');

    const mismatch = await ctx
      .http()
      .post('/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'admin123', newPassword: 'new-secret-1', confirmPassword: 'other' })
      .expect(400);
    expect(mismatch.body.code).toBe('VALIDATION_FAILED');

    const ok = await ctx
      .http()
      .post('/auth/change-password')
      .set('Cookie', cookie)
      .send({
        currentPassword: 'admin123',
        newPassword: 'new-secret-1',
        confirmPassword: 'new-secret-1',
      })
      .expect(200);
    expect(ok.body.usingDefaultPassword).toBe(false);

    await ctx.http().post('/auth/login').send(ADMIN).expect(401);
    await ctx
      .http()
      .post('/auth/login')
      .send({ username: 'admin', password: 'new-secret-1' })
      .expect(200);

    // audited, with secrets redacted
    const audit = await ctx.prisma.auditLog.findFirst({ where: { entity: 'User' } });
    expect(audit?.action).toBe('UPDATE');
    expect(JSON.stringify(audit?.summary)).not.toContain('new-secret-1');
  });

  it('rate-limits after 10 failed attempts per minute', async () => {
    for (let i = 0; i < 10; i++) {
      await ctx
        .http()
        .post('/auth/login')
        .set('X-Forwarded-For', '10.9.9.9')
        .send({ username: 'admin', password: `bad-${i}` })
        .expect(401);
    }
    const blocked = await ctx
      .http()
      .post('/auth/login')
      .set('X-Forwarded-For', '10.9.9.9')
      .send(ADMIN)
      .expect(429);
    expect(blocked.body.code).toBe('TOO_MANY_ATTEMPTS');
    expect(blocked.headers['retry-after']).toBeDefined();
  });
});
