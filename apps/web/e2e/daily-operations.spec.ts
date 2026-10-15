import { type Page, expect, test } from '@playwright/test';
import { login, samplePdf, setLocale, trackErrors } from './helpers';

/** Step 3 flows: schedule (with an overlap), Daily Entry, purchase → store → issue. */
const stamp = String(Date.now()).slice(-6);
/** "Rs. 1,040,800.00" → 1040800 */
const rupees = (text: string) => Number(text.replace('Rs.', '').replace(/[^\d.-]/g, ''));
const PROJECT = `E2E site ${stamp}`;
const WORKERS = [`E2E Mason ${stamp}`, `E2E Helper ${stamp}`];
const MATERIAL = `E2E cement ${stamp}`;

async function apiPost<T>(page: Page, path: string, data: object): Promise<T> {
  const res = await page.request.post(`/api${path}`, { data });
  expect(res.ok(), `${path}: ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
}

/** Opens an EntityPicker by its trigger and picks the option with this text. */
async function pick(page: Page, trigger: ReturnType<Page['locator']>, text: string) {
  await trigger.click();
  await page.getByTestId('picker-search').fill(text);
  await page
    .getByRole('option', { name: new RegExp(text) })
    .first()
    .click();
}

test.describe.serial('daily operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('setup: a project and two workers', async ({ page }) => {
    const clients = await (await page.request.get('/api/clients?pageSize=1')).json();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
    await apiPost(page, '/projects', {
      name: PROJECT,
      type: 'BUILDING',
      source: 'PRIVATE',
      clientId: clients.items[0].id,
      startDate: today,
      plannedEndDate: today,
      status: 'ONGOING',
    });
    for (const fullName of WORKERS) {
      await apiPost(page, '/workers', {
        fullName,
        skill: 'MASON',
        type: 'DAILY',
        joinedDate: '2026-01-01',
        dailyRate: '3500',
      });
    }
    await apiPost(page, '/materials', { name: MATERIAL, unit: 'bag', category: 'CEMENT' });
  });

  test('assign two workers for the week, then an overlap is explained', async ({ page }) => {
    const errors = trackErrors(page);
    await page.getByTestId('nav-schedule').click();
    await expect(page.getByTestId('page-title')).toHaveText('Schedule');
    await expect(page.getByTestId('schedule-grid')).toBeVisible();

    await page.getByTestId('assign-open').click();
    const dialog = page.getByTestId('assign-dialog');
    await pick(page, dialog.getByLabel('Project'), PROJECT);
    await dialog.getByPlaceholder('Search…').fill(`E2E`);
    for (const w of WORKERS) await dialog.getByLabel(w).check();
    await expect(dialog.getByTestId('assign-count')).toHaveText('2 chosen');
    await dialog.getByTestId('assign-save').click();
    await expect(page.getByText(/bookings added\./)).toBeVisible();
    await expect(dialog).toBeHidden();

    // the bookings show on the grid
    await page.getByPlaceholder('Search…').first().fill(`E2E Mason ${stamp}`);
    await expect(page.getByTestId('allocation-block').first()).toContainText(PROJECT);

    // booking the same worker again at the same time → friendly overlap dialog, nothing saved
    await page.getByTestId('assign-open').click();
    await pick(page, dialog.getByLabel('Project'), PROJECT);
    await dialog.getByPlaceholder('Search…').fill(WORKERS[0]!);
    await expect(dialog.getByText(/^Busy:/)).toBeVisible();
    await dialog.getByLabel(WORKERS[0]!).check();
    await dialog.getByTestId('assign-save').click();
    const conflict = page.getByTestId('conflict-dialog');
    await expect(conflict).toBeVisible();
    await expect(conflict).toContainText('Already booked');
    await expect(conflict).toContainText(WORKERS[0]!);
    await expect(conflict).toContainText(`Already at ${PROJECT}`);
    await conflict.getByRole('button', { name: 'Close' }).first().click();
    await page.keyboard.press('Escape');
    expect(errors.filter((e) => !e.includes('409'))).toEqual([]);
  });

  test('Daily Entry: attendance, machine hours, an expense with a receipt', async ({ page }) => {
    const errors = trackErrors(page);
    await page.getByTestId('nav-daily').click();
    await expect(page.getByTestId('page-title')).toHaveText('Daily Entry');
    await pick(page, page.getByLabel('Project (site)'), PROJECT);
    await expect(page.getByTestId('daily-form')).toBeVisible();

    // planned workers are listed; mark all present, give one OT
    const att = page.getByTestId('section-attendance');
    for (const w of WORKERS) await expect(att.getByText(w)).toBeVisible();
    await page.getByTestId('mark-all-present').click();
    await page.getByLabel(`Overtime hours of ${WORKERS[0]}`).fill('1.5');
    await page
      .getByLabel(`Attendance of ${WORKERS[1]}`)
      .getByRole('radio', { name: 'Half day' })
      .click();
    await expect(page.getByTestId('total-people')).toContainText('2');

    // a machine: hours come from the hour meter
    await pick(page, page.getByTestId('section-usage').getByRole('combobox'), 'Generator 25 kVA');
    const start = page.getByLabel('Start (hours) – Generator 25 kVA');
    const startValue = Number(await start.inputValue());
    await page.getByLabel('End (hours) – Generator 25 kVA').fill(String(startValue + 5));
    await expect(page.getByTestId('auto-hours')).toHaveText('5');
    await page.getByLabel('Fuel (litres) – Generator 25 kVA').fill('15');
    await page.getByLabel('Fuel cost – Generator 25 kVA').fill('4575');
    await expect(page.getByTestId('total-hours')).toHaveText('5');

    // an expense with a receipt
    await page.getByTestId('add-expense-row').click();
    await page.getByLabel('Category 1').click();
    await page.getByRole('option', { name: 'Meals', exact: true }).click();
    await page.getByLabel('What for 1').fill('Lunch for the team');
    await page.getByLabel('Amount 1').fill('4250');
    await page.getByTestId('receipt-0-file').setInputFiles({
      name: 'lunch-receipt.pdf',
      mimeType: 'application/pdf',
      buffer: samplePdf('lunch receipt'),
    });
    await expect(page.getByTestId('receipt-0-attached')).toBeVisible();
    await expect(page.getByTestId('total-expenses')).toHaveText('Rs. 4,250.00');
    await expect(page.getByTestId('unsaved')).toBeVisible();

    await page.getByTestId('daily-save').click();
    await expect(page.getByText('The day is saved.')).toBeVisible();
    await expect(page.getByTestId('unsaved')).toBeHidden();

    // reload: everything is still there
    await page.reload();
    await expect(page.getByTestId('daily-form')).toBeVisible();
    await expect(
      page.getByLabel(`Attendance of ${WORKERS[0]}`).getByRole('radio', { name: 'Present' }),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.getByLabel(`Attendance of ${WORKERS[1]}`).getByRole('radio', { name: 'Half day' }),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel(`Overtime hours of ${WORKERS[0]}`)).toHaveValue('1.5');
    await expect(page.getByTestId('auto-hours')).toHaveText('5');
    await expect(page.getByLabel('What for 1')).toHaveValue('Lunch for the team');
    await expect(page.getByTestId('receipt-0-attached')).toBeVisible();
    await expect(page.getByTestId('total-expenses')).toHaveText('Rs. 4,250.00');
    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: `e2e/screenshots/en-${width}-daily-filled.png`,
        fullPage: true,
      });
    }

    // the expense is in the Expenses list too
    await page.getByTestId('nav-expenses').click();
    await expect(page.getByTestId('page-title')).toHaveText('Expenses');
    await page.getByPlaceholder('Search…').first().fill('Lunch for the team');
    await expect(page.getByRole('cell', { name: /Lunch for the team/ }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('purchase to the store, issue to a project, stock goes down', async ({ page }) => {
    const errors = trackErrors(page);
    await page.getByTestId('nav-purchases').click();
    await expect(page.getByTestId('tab-purchases')).toHaveAttribute('data-state', 'active');
    await page.getByTestId('add-purchase').click();
    const dialog = page.getByTestId('purchase-dialog');
    await pick(page, dialog.getByLabel('Supplier'), 'Polonnaruwa Cement');
    await dialog.getByLabel('Bill / invoice no.').fill(`INV-${stamp}`);
    await pick(page, dialog.getByTestId('line-0').getByRole('combobox').first(), MATERIAL);
    await dialog.getByLabel('Quantity 1').fill('100');
    await dialog.getByLabel('Unit price 1').fill('2150');
    await expect(dialog.getByTestId('purchase-total')).toHaveText('Rs. 215,000.00');
    await dialog.getByTestId('purchase-save').click();
    await expect(page.getByText('Purchase saved.')).toBeVisible();

    await page.getByTestId('tab-store').click();
    const row = page.getByTestId(`stock-${MATERIAL}`);
    await expect(row.getByTestId('stock-qty')).toHaveText('100 bag');
    await row.getByRole('button', { name: 'Issue' }).click();
    const issue = page.getByTestId('issue-dialog');
    await expect(issue.getByTestId('issue-available')).toContainText('In the store: 100 bag');
    await pick(page, issue.getByLabel('Project'), PROJECT);
    await issue.getByLabel('Quantity (bag)').fill('130');
    await issue.getByTestId('issue-save').click();
    await expect(page.getByText('Not enough in the store. Only 100 bag left.')).toBeVisible();
    await issue.getByLabel('Quantity (bag)').fill('30');
    await issue.getByTestId('issue-save').click();
    await expect(page.getByText('Issued to the project.')).toBeVisible();
    await expect(row.getByTestId('stock-qty')).toHaveText('70 bag');

    await page.getByTestId('tab-issues').click();
    await page.getByPlaceholder('Search…').first().fill(MATERIAL);
    const issued = page.getByRole('row').filter({ hasText: PROJECT });
    await expect(issued).toHaveCount(1);
    await expect(issued).toContainText('Rs. 64,500.00');
    expect(errors.filter((e) => !e.includes('409'))).toEqual([]);
  });

  test('supplier statement shows the credit purchase; a payment lowers what we owe', async ({
    page,
  }) => {
    await page.getByTestId('nav-suppliers').click();
    await page.getByRole('link', { name: 'Polonnaruwa Cement Distributors' }).click();
    await page.getByTestId('tab-statement').click();
    await expect(page.getByTestId('statement-table')).toContainText(`INV-${stamp}`);
    const owed = await page.getByTestId('supplier-owed').innerText();
    const before = rupees(owed);
    await page.getByTestId('add-payment').click();
    await page.getByTestId('payment-dialog').getByLabel('Amount').fill('15000');
    await page.getByTestId('payment-save').click();
    await expect(page.getByText('Payment saved.')).toBeVisible();
    await expect(page.getByTestId('supplier-owed')).not.toHaveText(owed);
    const after = rupees(await page.getByTestId('supplier-owed').innerText());
    expect(before - after).toBe(15000);
  });

  test('Sinhala smoke check on Daily Entry and Schedule', async ({ page }) => {
    const errors = trackErrors(page);
    await setLocale(page, 'si');
    await page.goto('/daily');
    await expect(page.getByTestId('page-title')).toHaveText('දෛනික සටහන්');
    await pick(page, page.getByLabel('ව්‍යාපෘතිය (අඩවිය)'), PROJECT);
    await expect(page.getByTestId('section-attendance')).toContainText('පැමිණීම');
    await expect(page.getByTestId('section-usage')).toContainText('යන්ත්‍ර');
    await expect(page.getByTestId('daily-save')).toHaveText(/සුරකින්න/);
    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: `e2e/screenshots/si-${width}-daily-filled.png`,
        fullPage: true,
      });
    }
    await page.goto('/schedule');
    await expect(page.getByTestId('page-title')).toHaveText('වැඩ සැලැස්ම');
    await expect(page.getByTestId('kind-toggle')).toContainText('සේවකයින්');
    await setLocale(page, 'en');
    expect(errors).toEqual([]);
  });
});
