import { expect, test } from '@playwright/test';
import { login, setLocale, trackErrors } from './helpers';

/**
 * Visual sanity pass: every built page in English and Sinhala at 1280px and 1440px.
 * Screenshots go to e2e/screenshots/ (git-ignored) for a human/agent to look at.
 * Also fails on console errors, horizontal overflow, or raw i18n keys on the page.
 */
const PAGES = [
  '/dashboard',
  '/settings',
  '/settings?tab=payroll',
  '/settings?tab=clients',
  '/settings?tab=backup',
  '/settings?tab=sampleData',
  '/projects',
  '/projects/new',
  '/projects/clients',
  '/workers',
  '/workers/new',
  '/assets',
  '/assets/new',
  '/suppliers',
  '/purchases',
  '/purchases?tab=store',
  '/purchases?tab=issues',
  '/purchases?tab=materials',
  '/schedule',
  '/daily',
  '/daily/expenses',
  '/payroll',
  '/reports',
  '/notifications',
  '/documents',
  '/documents?tab=all',
  '/guide',
  '/guide?topic=daily-attendance',
  '/login',
] as const;
/** List pages whose first row opens a detail page (checked too). */
const DETAILS = [
  '/projects',
  // the sample road project has a BOQ, bills, a variation and bonds (step 4 tabs)
  '/projects?search=Rural road',
  '/workers',
  '/assets',
  '/suppliers',
] as const;
const WIDTHS = [1280, 1440] as const;
const RAW_KEY =
  /\b(common|nav|auth|settings|dashboard|errors|enums|projects|clients|workers|assets|suppliers|materials|purchases|documents|schedule|daily|expenses|attendance|advances|store|payroll|health|costs|boq|variations|eot|bills|payments|bonds|reports|notifications|backup|sampleData|guide)\.[a-zA-Z]+(\.[a-zA-Z_]+)*\b/;

/** Tables whose content is wider than their box (the user would have to scroll sideways). */
const clippedTables = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-slot="table-container"]')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map(
        (el) => `${el.querySelector('th')?.textContent ?? '?'} ${el.scrollWidth}/${el.clientWidth}`,
      ),
  );

for (const locale of ['en', 'si'] as const) {
  test(`pages render cleanly in ${locale}`, async ({ page }) => {
    test.setTimeout(900_000);
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
        expect(await clippedTables(page), `clipped table on ${path} at ${width}px`).toEqual([]);
        const name = path.replace(/[/?=]+/g, '_').replace(/^_/, '');
        await page.screenshot({
          path: `e2e/screenshots/${locale}-${width}-${name}.png`,
          fullPage: true,
        });
      }
      for (const list of DETAILS) {
        const [path, query] = list.split('?search=');
        await page.goto(path!);
        if (query) {
          // the list keeps its search in state, not in the URL: type it
          await page.locator('input[type="search"]').first().fill(query);
          await expect(page.locator('tbody a[href^="/"]').first()).toContainText(query);
        }
        await page.locator('tbody a[href^="/"]').first().click();
        const base = list.split('?')[0]!;
        const name = list.includes('?')
          ? `${base.slice(1)}-${list.split('=')[1]!.split(' ')[0]!.toLowerCase()}`
          : base.slice(1);
        await expect(page).toHaveURL(new RegExp(`${base}/[0-9a-f-]{36}$`));
        await expect(page.getByTestId('edit-button')).toBeVisible();
        await page.waitForLoadState('networkidle');
        const text = await page.locator('body').innerText();
        expect(text, `raw i18n key on ${list} detail`).not.toMatch(RAW_KEY);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        expect(overflow, `horizontal overflow on ${list} detail at ${width}px`).toBe(false);
        await page.screenshot({
          path: `e2e/screenshots/${locale}-${width}-${name}-detail.png`,
          fullPage: true,
        });
        // every tab of the detail page
        const tabs = await page
          .getByRole('tab')
          .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
        for (const tab of tabs) {
          if (!tab) continue;
          await page.getByTestId(tab).click();
          await page.waitForLoadState('networkidle');
          const tabText = await page.locator('body').innerText();
          expect(tabText, `raw i18n key on ${list} ${tab}`).not.toMatch(RAW_KEY);
          const tabOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
          );
          expect(tabOverflow, `horizontal overflow on ${list} ${tab} at ${width}px`).toBe(false);
          expect(
            await clippedTables(page),
            `clipped table on ${list} ${tab} at ${width}px`,
          ).toEqual([]);
          await page.screenshot({
            path: `e2e/screenshots/${locale}-${width}-${name}-${tab}.png`,
            fullPage: true,
          });
        }
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
