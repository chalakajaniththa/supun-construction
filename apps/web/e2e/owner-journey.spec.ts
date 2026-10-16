import { statSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';
import { login, openPickerSearch, samplePdf, setLocale, trackErrors } from './helpers';

/**
 * Step 6 — the owner's whole day, in one go:
 * dashboard → Daily Entry → renew an expiring vehicle insurance (its reminder clears) → payroll →
 * payslips PDF → a bill → its payment → "Back up now" → backup status green.
 * Needs the full stack including the `backup` service.
 */
const stamp = String(Date.now()).slice(-6);
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
const PROJECT = `Journey site ${stamp}`;
const WORKER = `Journey Mason ${stamp}`;

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function apiJson<T>(page: Page, method: 'get' | 'post' | 'put', path: string, data?: object) {
  const res = await page.request[method](`/api${path}`, data ? { data } : undefined);
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
}

interface DocItem {
  id: string;
  ownerId: string | null;
  ownerType: string;
  ownerName: string | null;
  category: string;
  title: string;
}

/** An asset insurance document expiring within 30 days (made if the sample has none left). */
async function expiringInsurance(page: Page): Promise<DocItem> {
  const docs = await apiJson<{ items: DocItem[] }>(
    page,
    'get',
    '/documents?expiring=30&pageSize=100',
  );
  const found = docs.items.find((d) => d.ownerType === 'ASSET' && d.category === 'INSURANCE');
  if (found) return found;
  const assets = await apiJson<{ items: { id: string; isVehicle: boolean }[] }>(
    page,
    'get',
    '/assets?pageSize=100',
  );
  const vehicle = assets.items.find((a) => a.isVehicle)!;
  const res = await page.request.post('/api/documents', {
    multipart: {
      ownerType: 'ASSET',
      ownerId: vehicle.id,
      category: 'INSURANCE',
      title: `Insurance ${stamp}`,
      expiryDate: addDays(today, 5),
      file: { name: 'insurance.pdf', mimeType: 'application/pdf', buffer: samplePdf('ins') },
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  await apiJson(page, 'post', '/reminders/run', {});
  const again = await apiJson<{ items: DocItem[] }>(
    page,
    'get',
    '/documents?expiring=30&pageSize=100',
  );
  return again.items.find((d) => d.ownerType === 'ASSET' && d.category === 'INSURANCE')!;
}

async function openReminders(page: Page, docId: string) {
  const list = await apiJson<{ items: { entityType: string; entityId: string }[] }>(
    page,
    'get',
    '/notifications?pageSize=100',
  );
  return list.items.filter((n) => n.entityType === 'DOCUMENT' && n.entityId === docId).length;
}

/** Opens a DateInput and picks a day in any month/year via the calendar's dropdowns. */
async function pickAnyDate(page: Page, label: string, day: string) {
  await page.getByLabel(label, { exact: true }).click();
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const pop = page.locator('[data-slot="popover-content"][data-state="open"]');
  await pop.getByRole('combobox', { name: /year/i }).selectOption(String(y));
  await pop.getByRole('combobox', { name: /month/i }).selectOption(String(m - 1));
  await pop
    .locator(
      `button[data-day="${new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { timeZone: 'UTC' })}"]`,
    )
    .first()
    .click();
}

let projectId = '';

test.describe.serial('owner journey', () => {
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('setup: a site with a planned worker and a measured BOQ', async ({ page }) => {
    const clients = await apiJson<{ items: { id: string }[] }>(page, 'get', '/clients?pageSize=1');
    const project = await apiJson<{ id: string }>(page, 'post', '/projects', {
      name: PROJECT,
      type: 'BUILDING',
      source: 'GOVERNMENT_TENDER',
      clientId: clients.items[0]!.id,
      contractValue: '500000',
      retentionPct: '10',
      retentionCapPct: '5',
      startDate: `${today.slice(0, 4)}-01-01`,
      plannedEndDate: `${today.slice(0, 4)}-12-31`,
      status: 'ONGOING',
    });
    projectId = project.id;
    const worker = await apiJson<{ id: string }>(page, 'post', '/workers', {
      fullName: WORKER,
      skill: 'MASON',
      type: 'DAILY',
      joinedDate: '2026-01-01',
      dailyRate: '4000',
    });
    await apiJson(page, 'post', '/allocations/workers', {
      workerIds: [worker.id],
      projectId,
      fromDate: today,
      startTime: '08:00',
      endTime: '17:00',
    });
    const item = await apiJson<{ id: string }>(page, 'post', `/projects/${projectId}/boq`, {
      itemNo: '1',
      description: 'Brick wall',
      unit: 'm2',
      quantity: '100',
      rate: '5000',
    });
    await apiJson(page, 'post', `/projects/${projectId}/progress`, {
      date: today,
      items: [{ boqItemId: item.id, cumulativeQty: '40' }],
    });
  });

  test("the owner's day in English", async ({ page }) => {
    const errors = trackErrors(page);

    // 1. Dashboard
    await expect(page.getByTestId('page-title')).toBeVisible();
    await expect(page.getByTestId('kpi-activeProjects')).toBeVisible();
    await expect(page.getByTestId('backup-dot')).toBeVisible();

    // 2. Daily Entry for today: the planned worker is listed → present → save
    await page.getByTestId('nav-daily').click();
    await expect(page.getByTestId('page-title')).toHaveText('Daily Entry');
    await page.getByLabel('Project (site)').click();
    await openPickerSearch(page).fill(PROJECT);
    await page
      .getByRole('option', { name: new RegExp(PROJECT) })
      .first()
      .click();
    await expect(page.getByTestId('section-attendance').getByText(WORKER)).toBeVisible();
    await page.getByTestId('mark-all-present').click();
    await page.getByTestId('daily-save').click();
    await expect(page.getByText('The day is saved.')).toBeVisible();

    // 3. Renew an expiring vehicle insurance → its reminder clears
    const doc = await expiringInsurance(page);
    expect(await openReminders(page, doc.id)).toBeGreaterThan(0);
    await page.goto(`/assets/${doc.ownerId}?tab=documents`);
    const row = page.getByRole('row', { name: new RegExp(doc.title) });
    await row.getByTestId('new-version-button').click();
    await page.getByTestId('file-input').setInputFiles({
      name: `insurance-renewed-${stamp}.pdf`,
      mimeType: 'application/pdf',
      buffer: samplePdf('renewed insurance'),
    });
    await pickAnyDate(page, 'Expiry date', addDays(today, 365));
    await page.getByTestId('version-submit').click();
    await expect(page.getByText('New version uploaded.')).toBeVisible();
    await expect.poll(() => openReminders(page, doc.id)).toBe(0);

    // 4. Payroll for this month → payslips PDF
    await page.getByTestId('nav-payroll').click();
    await expect(page.getByTestId('page-title')).toHaveText('Payroll');
    await page.getByTestId('generate-payroll').click();
    await expect(page.getByText('Salaries calculated.')).toBeVisible();
    await expect(page.getByTestId('payroll-table')).toContainText(WORKER);
    const [payslips] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-payslips-pdf').click(),
    ]);
    expect(payslips.suggestedFilename()).toMatch(/^payslips_\d{4}-\d{2}.*\.pdf$/);
    expect(statSync((await payslips.path())!).size).toBeGreaterThan(1000);

    // 5. A bill (IPC) and its payment
    await page.goto(`/projects/${projectId}?tab=bills`);
    await page.getByTestId('new-bill').click();
    const bill = page.getByTestId('bill-dialog');
    await bill.getByTestId('bill-calculate').click();
    await expect(bill.getByTestId('calc-gross')).toHaveText('Rs. 200,000.00');
    await expect(bill.getByTestId('calc-net')).toHaveText('Rs. 180,000.00');
    await bill.getByTestId('bill-save').click();
    await expect(bill).toBeHidden();
    const billRow = page.getByTestId('bill-row-1');
    await billRow.getByTestId('bill-submit').click();
    await page.getByTestId('bill-status-save').click();
    await expect(billRow).toContainText('Submitted');
    await billRow.getByTestId('bill-certify').click();
    await page.getByTestId('bill-status-save').click();
    await expect(billRow).toContainText('Certified');
    await expect(page.getByTestId('summary-receivable')).toHaveText('Rs. 180,000.00');
    await page.getByTestId('record-payment').click();
    const pay = page.getByTestId('payment-dialog');
    await expect(pay.getByTestId('payment-amount')).toHaveValue('180000.00');
    await pay.getByTestId('payment-save').click();
    await expect(pay).toBeHidden();
    await expect(page.getByTestId('summary-receivable')).toHaveText('Rs. 0.00');

    // 6. Back up now → green
    await page.goto('/settings?tab=backup');
    await expect(page.getByTestId('backup-status-card')).toBeVisible();
    await expect(page.getByTestId('backup-agent')).toHaveText('Backup service is running');
    await page.getByTestId('backup-now').click();
    await expect(page.getByText('Backup finished successfully.')).toBeVisible({ timeout: 180_000 });
    await expect(page.getByTestId('backup-state')).toHaveAttribute('data-state', 'OK');
    await expect(page.getByTestId('backup-state')).toContainText('Backups are up to date');
    await expect(
      page.getByTestId('backup-history').getByTestId('backup-run').first(),
    ).toContainText('Successful');
    await expect(page.getByTestId('backup-dot')).toHaveAttribute('data-state', 'OK');
    expect(errors).toEqual([]);
  });

  test('reset sample data asks for the typed word RESET', async ({ page }) => {
    await page.goto('/settings?tab=sampleData');
    await page.getByTestId('reset-open').click();
    await expect(page.getByTestId('reset-submit')).toBeDisabled();
    await page.getByTestId('reset-confirm').fill('reset');
    await expect(page.getByTestId('reset-submit')).toBeDisabled();
    await page.getByTestId('reset-confirm').fill('RESET');
    await expect(page.getByTestId('reset-submit')).toBeEnabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('reset-confirm')).toBeHidden();
  });

  test('Sinhala: dashboard, Settings → Backup, back up now', async ({ page }) => {
    const errors = trackErrors(page);
    await setLocale(page, 'si');
    await expect(page.getByTestId('kpi-activeProjects')).toBeVisible();
    await page.goto('/settings?tab=backup');
    await expect(page.getByTestId('tab-backup')).toHaveText('බැකප්');
    await expect(page.getByTestId('backup-agent')).toHaveText('බැකප් සේවාව ක්‍රියාත්මකයි');
    await page.getByTestId('backup-now').click();
    await expect(page.getByText('බැකප් එක සාර්ථකව අවසන් විය.')).toBeVisible({ timeout: 180_000 });
    await expect(page.getByTestId('backup-state')).toContainText('බැකප් යාවත්කාලීනයි');
    await page.getByTestId('tab-sampleData').click();
    await expect(page.getByTestId('reset-open')).toHaveText(/නියැදි දත්ත යළි සකසන්න/);
    await setLocale(page, 'en');
    expect(errors).toEqual([]);
  });
});
