import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

/**
 * Once per e2e run: apply every migration to the `supun_test` database (`prisma migrate deploy`).
 * Each test file then empties all tables with resetDb() (TRUNCATE) — see test/helpers.ts.
 * (Not `migrate reset`: Prisma 7 refuses it when run by an AI agent, and deploy is non-destructive.)
 */
export default function setup(): void {
  const env = parseEnv(readFileSync(new URL('../.env.test', import.meta.url), 'utf8'));
  if (!String(env.DATABASE_URL).includes('/supun_test')) {
    throw new Error('Refusing to run e2e tests against a database that is not supun_test');
  }
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
}
