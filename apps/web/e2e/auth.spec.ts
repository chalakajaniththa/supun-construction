import { expect, test } from '@playwright/test';
import { ADMIN, login, trackErrors } from './helpers';

test.describe('login & logout', () => {
  test('a protected page redirects to /login when logged out', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings/);
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  });

  test('wrong password shows a friendly error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill(ADMIN.username);
    await page.locator('#password').fill('definitely-wrong');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toHaveText('Wrong username or password.');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login → dashboard, then logout', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await expect(page.getByTestId('page-title')).toHaveText('Dashboard');
    await expect(page.getByTestId('kpi-activeProjects')).toBeVisible();
    await expect(page.getByTestId('company-name')).not.toBeEmpty();
    // every nav item is there
    for (const key of [
      'dashboard',
      'daily',
      'projects',
      'schedule',
      'workers',
      'assets',
      'purchases',
      'suppliers',
      'payroll',
      'reports',
      'documents',
      'settings',
    ]) {
      await expect(page.getByTestId(`nav-${key}`)).toBeVisible();
    }

    await page.getByTestId('user-menu').click();
    await page.getByTestId('logout').click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    expect(errors).toEqual([]);
  });

  test('returns to the requested page after login', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/next=%2Fprojects/);
    await page.getByLabel('Username').fill(ADMIN.username);
    await page.locator('#password').fill(ADMIN.password);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByTestId('page-title')).toHaveText('Projects');
  });
});
