import { expect, test } from '@playwright/test';
import { login, trackErrors } from './helpers';

test.describe('settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByTestId('nav-settings').click();
    await expect(page.getByTestId('page-title')).toHaveText('Settings');
  });

  test('company info saves and persists after reload', async ({ page }) => {
    const errors = trackErrors(page);
    const phoneInput = page.getByLabel('Phone number');
    const original = await phoneInput.inputValue();
    const phone = `027 ${String(Date.now()).slice(-3)} ${String(Date.now()).slice(-7, -3)}`;

    await phoneInput.fill(phone);
    await page.getByTestId('form-company').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Phone number')).toHaveValue(phone);

    // put it back
    await page.getByLabel('Phone number').fill(original);
    await page.getByTestId('form-company').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved.').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('payroll rates are validated with friendly messages', async ({ page }) => {
    await page.getByTestId('tab-payroll').click();
    const epf = page.getByLabel("EPF – worker's share (%)");
    await expect(epf).toHaveValue('8');
    await epf.fill('150');
    await page.getByTestId('form-payroll').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('This cannot be more than 100.')).toBeVisible();
    await page.reload();
    await page.getByTestId('tab-payroll').click();
    await expect(page.getByLabel("EPF – worker's share (%)")).toHaveValue('8');
  });

  test('reminder days save', async ({ page }) => {
    await page.getByTestId('tab-reminders').click();
    const input = page.getByLabel('Remind me this many days before');
    await expect(input).toHaveValue('30, 14, 7');
    await input.fill('7, 30, 14, 60');
    await page.getByTestId('form-reminders').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved.')).toBeVisible();
    await expect(input).toHaveValue('60, 30, 14, 7');
    await input.fill('abc');
    await page.getByTestId('form-reminders').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/whole numbers between 1 and 365/)).toBeVisible();
    await input.fill('30, 14, 7');
    await page.getByTestId('form-reminders').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Settings saved.').first()).toBeVisible();
  });

  test('change password shows an error for a wrong current password', async ({ page }) => {
    await page.getByTestId('tab-password').click();
    await page.getByLabel('Current password').fill('not-the-password');
    await page.getByLabel('New password', { exact: true }).fill('new-password-123');
    await page.getByLabel('New password again').fill('new-password-123');
    await page
      .getByTestId('form-password')
      .getByRole('button', { name: 'Change password' })
      .click();
    await expect(page.getByText('The password is not correct.')).toBeVisible();
  });

  test('the user menu opens the password tab', async ({ page }) => {
    await page.getByTestId('user-menu').click();
    await page.getByTestId('menu-change-password').click();
    await expect(page).toHaveURL(/tab=password/);
    await expect(page.getByLabel('Current password')).toBeVisible();
  });
});
