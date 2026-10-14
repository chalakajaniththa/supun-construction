import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

// e2e tests run against the dev infra (docker-compose.dev.yml) and the `supun_test` database.
const env = parseEnv(readFileSync(new URL('./.env.test', import.meta.url), 'utf8')) as Record<
  string,
  string
>;

export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    environment: 'node',
    env,
    globalSetup: ['./test/global-setup.ts'],
    // All files share one database; run them one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
