import { expect, test } from '@playwright/test';
import { login, pickDate, samplePdf, selectOption, setLocale, trackErrors } from './helpers';

const stamp = () => String(Date.now()).slice(-6);

test.describe('master data', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('create a project with a budget', async ({ page }) => {
    const errors = trackErrors(page);
    const name = `E2E road project ${stamp()}`;
    await page.getByTestId('nav-projects').click();
    await expect(page.getByTestId('page-title')).toHaveText('Projects');
    await page.getByTestId('new-project').click();
    await expect(page.getByTestId('page-title')).toHaveText('New project');

    await page.getByLabel('Project name').fill(name);
    await selectOption(page, 'Type of work', 'Road');
    await selectOption(page, 'Government or private', 'Government tender');
    await page.getByLabel('Client', { exact: true }).click();
    await page.getByRole('option').first().click();
    const today = new Date();
    await pickDate(page, 'Start date', today);
    await pickDate(page, 'Planned finish date', today);
    await page.getByLabel('Contract value').fill('12500000');
    await page.getByTestId('form-submit').click();

    await expect(page.getByTestId('page-title')).toHaveText(name);
    await expect(page.getByText(/^PRJ-\d{4}-\d{3}$/)).toBeVisible();

    // budget
    await page.getByTestId('budget-amount-LABOUR').fill('1000000');
    await page.getByTestId('budget-amount-MATERIALS').fill('2500000.50');
    await expect(page.getByTestId('budget-total')).toHaveText('Rs. 3,500,000.50');
    await page.getByTestId('budget-save').click();
    await expect(page.getByText('Budget saved.')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('budget-total')).toHaveText('Rs. 3,500,000.50');
    await expect(page.getByText('Rs. 3,500,000.50').first()).toBeVisible();

    // it is in the list
    await page.getByTestId('nav-projects').click();
    await page.getByPlaceholder('Search…').fill(name);
    await expect(page.getByRole('link', { name })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('create a worker and add a new pay rate', async ({ page }) => {
    const errors = trackErrors(page);
    const name = `E2E Worker ${stamp()}`;
    await page.getByTestId('nav-workers').click();
    await page.getByTestId('new-worker').click();
    await page.getByLabel('Full name').fill(name);
    await page.getByLabel('NIC number').fill('12345');
    await selectOption(page, 'Skill', 'Mason');
    // joined on the 10th of last month
    const now = new Date();
    const joined = new Date(now.getFullYear(), now.getMonth() - 1, 10);
    await pickDate(page, 'Joined on', joined, 1);
    await page.getByLabel('Daily rate').fill('3500');
    await page.getByTestId('form-submit').click();
    // NIC is validated in the form
    await expect(page.getByText('Enter a NIC like 851234567V or 198512345678.')).toBeVisible();
    await page.getByLabel('NIC number').fill('');
    await page.getByTestId('form-submit').click();

    await expect(page.getByTestId('page-title')).toHaveText(name);
    await expect(page.getByText('Rs. 3,500.00 / day')).toBeVisible();

    await page.getByTestId('tab-rates').click();
    await expect(page.getByTestId('rate-history').getByRole('row')).toHaveCount(2); // header + 1
    await page.getByTestId('add-rate').click();
    await page.getByLabel('Daily rate').fill('3800');
    await page.getByTestId('rate-submit').click();
    await expect(page.getByText('New pay rate saved.')).toBeVisible();
    await expect(page.getByTestId('rate-history').getByRole('row')).toHaveCount(3);
    await expect(page.getByTestId('rate-history').getByText('Rs. 3,800.00')).toBeVisible();

    // the list shows the new current rate
    await page.getByTestId('nav-workers').click();
    await page.getByPlaceholder('Search…').fill(name);
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText(
      'Rs. 3,800.00 / day',
    );
    expect(errors).toEqual([]);
  });

  test('create an asset, upload an insurance document and a new version', async ({ page }) => {
    const errors = trackErrors(page);
    const name = `E2E Tipper ${stamp()}`;
    await page.getByTestId('nav-assets').click();
    await page.getByTestId('new-asset').click();
    await page.getByLabel('Name', { exact: true }).fill(name);
    await selectOption(page, 'Kind', 'Tipper');
    await expect(page.getByLabel('This is a road vehicle')).toBeChecked();
    await page.getByLabel('Registration number').fill(`e2e-${stamp()}`);
    await page.getByTestId('form-submit').click();
    await expect(page.getByTestId('page-title')).toHaveText(name);

    await page.getByTestId('tab-documents').click();
    await page.getByTestId('upload-document').click();
    await page.getByTestId('file-input').setInputFiles({
      name: 'insurance-2026.pdf',
      mimeType: 'application/pdf',
      buffer: samplePdf('insurance 2026'),
    });
    await expect(page.getByLabel('Title')).toHaveValue('insurance-2026');
    await selectOption(page, 'Kind', 'Insurance');
    await page.getByLabel('Title').fill('Vehicle insurance');
    await page.getByTestId('upload-submit').click();
    await expect(page.getByText('Document uploaded.')).toBeVisible();
    const row = page.getByRole('row', { name: /Vehicle insurance/ });
    await expect(row.getByTestId('document-version')).toHaveText('Version 1');

    await row.getByTestId('new-version-button').click();
    await page.getByTestId('file-input').setInputFiles({
      name: 'insurance-2027.pdf',
      mimeType: 'application/pdf',
      buffer: samplePdf('insurance 2027'),
    });
    await page.getByTestId('version-submit').click();
    await expect(page.getByText('New version uploaded.')).toBeVisible();
    await expect(row.getByTestId('document-version')).toHaveText('Version 2');

    await row.getByTestId('history-button').click();
    const sheet = page.getByTestId('history-sheet');
    await expect(sheet.getByTestId('version-item')).toHaveCount(2);
    await expect(sheet.getByTestId('version-item').first()).toContainText('Version 2');
    await expect(sheet.getByTestId('version-item').first()).toContainText('insurance-2027.pdf');

    // the file can be downloaded
    const download = page.waitForEvent('download');
    await sheet.getByTestId('version-item').last().getByRole('link', { name: 'Download' }).click();
    expect((await download).suggestedFilename()).toBe('insurance-2026.pdf');
    expect(errors).toEqual([]);
  });

  test('wrong file types are refused before uploading', async ({ page }) => {
    await page.getByTestId('nav-documents').click();
    await page.getByTestId('upload-document').click();
    await page.getByTestId('file-input').setInputFiles({
      name: 'setup.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('MZ'),
    });
    await expect(page.getByText(/This type of file cannot be uploaded/)).toBeVisible();
  });

  test('Sinhala: the workers list', async ({ page }) => {
    const errors = trackErrors(page);
    await setLocale(page, 'si');
    await page.getByTestId('nav-workers').click();
    await expect(page.getByTestId('page-title')).toHaveText('සේවකයින්');
    await expect(page.getByRole('columnheader', { name: 'කුසලතාව' })).toBeVisible();
    await expect(page.getByText('දැන් වැඩ කරන').first()).toBeVisible();
    await expect(page.getByText(/\/ දිනකට/).first()).toBeVisible();
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/\b(workers|common|enums)\.[a-zA-Z]+/);
    await setLocale(page, 'en');
    expect(errors).toEqual([]);
  });
});
