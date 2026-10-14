import { expect, test } from '@playwright/test';
import { login, setLocale, trackErrors } from './helpers';

/**
 * Visual sanity pass: every built page in English and Sinhala at 1280px and 1440px.
 * Screenshots go to e2e/screenshots/ (git-ignored) for a human/agent to look at.
 * Also fails on console errors, horizontal overflow, or raw i18n keys on the page.
 */
const PAGES = ['/dashboard', '/settings', '/settings?tab=payroll', '/projects', '/login'] as const;
const WIDTHS = [1280, 1440] as const;
const RAW_KEY = /\b(common|nav|auth|settings|dashboard|errors|enums)\.[a-zA-Z]+(\.[a-zA-Z_]+)*\b/;

for (const locale of ['en', 'si'] as const) {
  test(`pages render cleanly in ${locale}`, async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await setLocale(page, locale);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of PAGES) {
        if (path === '/login') continue;
        await page.goto(path);
        await expect(page.getByTestId('page-title')).toBeVisible();
        await page.waitForLoadState('networkidle');
        const text = await page.locator('body').innerText();
        expect(text, `raw i18n key on ${path}`).not.toMatch(RAW_KEY);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        expect(overflow, `horizontal overflow on ${path} at ${width}px`).toBe(false);
        const name = path.replace(/[/?=]+/g, '_').replace(/^_/, '');
        await page.screenshot({
          path: `e2e/screenshots/${locale}-${width}-${name}.png`,
          fullPage: true,
        });
      }
    }
    // the login page (logged out)
    await page.context().clearCookies({ name: 'sc_session' });
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await page.screenshot({ path: `e2e/screenshots/${locale}-login.png` });
    expect(errors).toEqual([]);
  });
}
