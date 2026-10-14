import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: '0123456789abcdef0123',
  ADMIN_PASSWORD: 'admin123',
  S3_ENDPOINT: 'http://seaweedfs:8333',
  S3_ACCESS_KEY: 'key',
  S3_SECRET_KEY: 'secret',
  GOTENBERG_URL: 'http://gotenberg:3000',
};

describe('validateEnv', () => {
  it('accepts a minimal valid env and applies defaults', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(4000);
    expect(env.TZ).toBe('Asia/Colombo');
    expect(env.S3_BUCKET).toBe('supun-docs');
    expect(env.ADMIN_USERNAME).toBe('admin');
    expect(env.SEED_SAMPLE_DATA).toBe(false);
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['', false],
  ])('parses SEED_SAMPLE_DATA=%j as %s', (raw, expected) => {
    expect(validateEnv({ ...valid, SEED_SAMPLE_DATA: raw }).SEED_SAMPLE_DATA).toBe(expected);
  });

  it('coerces PORT', () => {
    expect(validateEnv({ ...valid, PORT: '4100' }).PORT).toBe(4100);
  });

  it.each(['DATABASE_URL', 'JWT_SECRET', 'S3_ENDPOINT', 'S3_ACCESS_KEY', 'GOTENBERG_URL'])(
    'rejects a missing %s',
    (key) => {
      const env: Record<string, string> = { ...valid };
      delete env[key];
      expect(() => validateEnv(env)).toThrow(key);
    },
  );

  it('rejects a short JWT secret and a non-postgres URL', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'short' })).toThrow('JWT_SECRET');
    expect(() => validateEnv({ ...valid, DATABASE_URL: 'mysql://x' })).toThrow('DATABASE_URL');
  });

  it('rejects an invalid bucket name', () => {
    expect(() => validateEnv({ ...valid, S3_BUCKET: 'Bad_Bucket' })).toThrow('S3_BUCKET');
  });
});
