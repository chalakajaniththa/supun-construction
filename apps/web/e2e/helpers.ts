import { type Page, expect } from '@playwright/test';

export const ADMIN = {
  username: process.env.E2E_USERNAME ?? 'admin',
  password: process.env.E2E_PASSWORD ?? 'admin123',
};

export async function login(page: Page, credentials = ADMIN): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/username|පරිශීලක නාමය/i).fill(credentials.username);
  await page.locator('#password').fill(credentials.password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Collects console errors and failed requests for a page (call before navigating). */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

export async function setLocale(page: Page, locale: 'en' | 'si'): Promise<void> {
  const button = page.getByTestId(`locale-${locale}`);
  if ((await button.getAttribute('aria-pressed')) !== 'true') {
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
}
