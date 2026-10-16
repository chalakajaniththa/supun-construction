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

/** Picks an option of a Radix select found by its label. */
export async function selectOption(
  page: Page,
  label: string | RegExp,
  option: string,
): Promise<void> {
  await page.getByLabel(label, { exact: typeof label === 'string' }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/** "15/10/2026" — the calendar's data-day format for the en-GB test browser. */
export function calendarDay(date: Date): string {
  return date.toLocaleDateString('en-GB');
}

/** Opens a DateInput by its label and clicks a day (navigating back `monthsBack` months first). */
export async function pickDate(
  page: Page,
  label: string,
  date: Date,
  monthsBack = 0,
): Promise<void> {
  await page.getByLabel(label, { exact: true }).click();
  for (let i = 0; i < monthsBack; i++) {
    await page.getByRole('button', { name: /previous month/i }).click();
  }
  await page
    .locator(`button[data-day="${calendarDay(date)}"]`)
    .first()
    .click();
}

/** A small valid PDF for uploads. */
export function samplePdf(text: string): Buffer {
  return Buffer.from(
    `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\n% ${text}\ntrailer << /Root 1 0 R >>\n%%EOF\n`,
  );
}

/**
 * The search box of the EntityPicker that is open now. A picker that was just closed stays in the
 * page for its fade-out animation, so `getByTestId('picker-search')` alone can match two boxes.
 */
export function openPickerSearch(page: Page) {
  return page
    .locator('[data-slot="popover-content"][data-state="open"]')
    .getByTestId('picker-search');
}
