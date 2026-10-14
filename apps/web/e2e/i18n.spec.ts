import { expect, test } from '@playwright/test';
import { login, setLocale, trackErrors } from './helpers';

test.describe('language toggle', () => {
  test('switching to Sinhala changes the nav and persists after reload', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await expect(page.getByTestId('nav-projects')).toHaveText('Projects');

    await setLocale(page, 'si');
    await expect(page.getByTestId('nav-projects')).toHaveText('ව්‍යාපෘති');
    await expect(page.getByTestId('nav-settings')).toHaveText('සැකසුම්');
    await expect(page.getByTestId('page-title')).toHaveText('මුල් පිටුව');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'si');
    await expect(page.getByTestId('nav-projects')).toHaveText('ව්‍යාපෘති');

    // the choice is kept in the NEXT_LOCALE cookie
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('si');

    // other pages are in Sinhala too
    await page.getByTestId('nav-settings').click();
    await expect(page.getByTestId('page-title')).toHaveText('සැකසුම්');
    await expect(page.getByTestId('tab-password')).toHaveText('මුරපදය');

    await setLocale(page, 'en');
    await expect(page.getByTestId('nav-projects')).toHaveText('Projects');
    expect(errors).toEqual([]);
  });

  test('the login page can be switched to Sinhala', async ({ page }) => {
    await page.goto('/login');
    await setLocale(page, 'si');
    await expect(page.getByRole('heading', { name: 'ආයුබෝවන්' })).toBeVisible();
    await expect(page.getByTestId('login-submit')).toHaveText(/ඇතුළු වන්න/);
  });
});
