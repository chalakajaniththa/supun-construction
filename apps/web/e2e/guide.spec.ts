import { expect, test } from '@playwright/test';
import { login, setLocale, trackErrors } from './helpers';

test.describe('user guide', () => {
  test('search, open a topic with pictures, and the Help button', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await setLocale(page, 'en');

    await page.getByTestId('nav-guide').click();
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.getByTestId('guide-popular')).toBeVisible();

    // search finds the salary topic first
    await page.getByTestId('guide-search').fill('salary');
    const results = page.getByTestId('guide-results');
    await expect(results.locator('[data-testid^="guide-topic-"]').first()).toHaveAttribute(
      'data-testid',
      'guide-topic-payroll',
    );
    await results.getByTestId('guide-topic-payroll').click();
    await expect(page).toHaveURL(/topic=payroll/);
    await expect(page.getByTestId('guide-topic-title')).toHaveText('Pay the monthly salaries');
    // the screen labels come from the app's own texts
    await expect(page.getByTestId('guide-steps')).toContainText('Calculate salaries');
    const shot = page.getByTestId('guide-shot').first();
    await expect(shot).toHaveAttribute('src', '/guide/en/payroll-month.webp');
    await expect
      .poll(() => shot.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    // "Open this page" goes to the page the topic is about
    await page.getByTestId('guide-open-page').click();
    await expect(page).toHaveURL(/\/payroll$/);

    // the Help button opens the guide at the section of the current page
    await page.getByTestId('help-button').click();
    await expect(page).toHaveURL(/\/guide\?section=workers$/);
    await expect(page.getByTestId('guide-section-title')).toHaveText('Workers and salaries');
    expect(errors).toEqual([]);
  });

  test('works in Sinhala, with Sinhala pictures and Sinhala search', async ({ page }) => {
    await login(page);
    await setLocale(page, 'si');
    await page.goto('/guide');
    await page.getByTestId('guide-search').fill('රක්ෂණය');
    await page.getByTestId('guide-topic-document-renew').click();
    await expect(page.getByTestId('guide-topic-title')).toContainText('රක්ෂණය');
    await expect(page.getByTestId('guide-shot').first()).toHaveAttribute('src', /^\/guide\/si\//);
    // English words still find topics while the screen is in Sinhala
    await page.goto('/guide');
    await page.getByTestId('guide-search').fill('EPF');
    await expect(page.getByTestId('guide-topic-payroll')).toBeVisible();
    await setLocale(page, 'en');
  });
});
