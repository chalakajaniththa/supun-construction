import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the full Docker stack (`docker compose up -d --build`) at
 * http://localhost:3000. Override with PLAYWRIGHT_BASE_URL. They use the seeded admin
 * (E2E_USERNAME / E2E_PASSWORD, default admin / admin123).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
    locale: 'en-GB',
    timezoneId: 'Asia/Colombo',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
});
