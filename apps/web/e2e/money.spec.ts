import { type Page, expect, test } from '@playwright/test';
import { login, setLocale, trackErrors } from './helpers';

/** Step 4 flows: payroll deductions, BOQ import → progress → bill → payment, Sinhala smoke. */
const stamp = String(Date.now()).slice(-6);
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
const PROJECT = `E2E road ${stamp}`;
const WORKER = `E2E Payroll ${stamp}`;

async function apiPost<T>(page: Page, path: string, data: object, method: 'post' | 'put' = 'post') {
  const res = await page.request[method](`/api${path}`, { data });
  expect(res.ok(), `${path}: ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
}

let projectId = '';
let workerCode = '';

test.describe.serial('money', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('setup: a government project, a worker with an advance and a day of work', async ({
    page,
  }) => {
    const clients = await (await page.request.get('/api/clients?pageSize=1')).json();
    const project = await apiPost<{ id: string }>(page, '/projects', {
      name: PROJECT,
      type: 'ROAD',
      source: 'GOVERNMENT_TENDER',
      clientId: clients.items[0].id,
      contractValue: '1000000',
      retentionPct: '10',
      retentionCapPct: '5',
      advanceAmount: '100000',
      advanceRecoveryPct: '20',
      startDate: `${today.slice(0, 4)}-01-01`,
      plannedEndDate: `${today.slice(0, 4)}-12-31`,
      status: 'ONGOING',
    });
    projectId = project.id;
    const worker = await apiPost<{ id: string; code: string }>(page, '/workers', {
      fullName: WORKER,
      skill: 'MASON',
      type: 'DAILY',
      joinedDate: '2026-01-01',
      dailyRate: '4000',
    });
    workerCode = worker.code;
    await apiPost(page, `/workers/${worker.id}/advances`, {
      date: today,
      amount: '6000',
      recoveryPerMonth: '2000',
    });
    await apiPost(
      page,
      '/daily-entry',
      {
        date: today,
        projectId,
        attendance: [{ workerId: worker.id, status: 'PRESENT', otHours: '0' }],
        usage: [],
        expenses: [],
      },
      'put',
    );
  });

  test("generate this month's payroll and change an advance deduction", async ({ page }) => {
    const errors = trackErrors(page);
    await page.getByTestId('nav-payroll').click();
    await expect(page.getByTestId('page-title')).toHaveText('Payroll');
    await page.getByTestId('generate-payroll').click();
    await expect(page.getByText('Salaries calculated.')).toBeVisible();

    const row = page.getByTestId(`payroll-row-${workerCode}`);
    // 1 day × 4,000 − the 2,000 instalment of the advance
    await expect(row.getByTestId('cell-advance')).toHaveText('2,000.00');
    await expect(row.getByTestId('cell-net')).toHaveText('2,000.00');

    await row.getByTestId('edit-line').click();
    const dialog = page.getByTestId('payroll-line-dialog');
    await dialog.getByTestId('line-advance').fill('3000');
    await expect(dialog.getByTestId('line-net-preview')).toHaveText('Rs. 1,000.00');
    await dialog.getByTestId('line-save').click();
    await expect(dialog).toBeHidden();
    await expect(row.getByTestId('cell-advance')).toHaveText('3,000.00');
    await expect(row.getByTestId('cell-net')).toHaveText('1,000.00');

    // more than the advance still owed is refused next to the field
    await row.getByTestId('edit-line').click();
    await dialog.getByTestId('line-advance').fill('7000');
    await dialog.getByTestId('line-save').click();
    await expect(dialog.getByText('More than the advance still owed.')).toBeVisible();
    await page.keyboard.press('Escape');
    // the refused save above is an expected 400
    expect(errors.filter((e) => !e.includes('400'))).toEqual([]);
  });

  test('import a BOQ, record progress, make a bill and receive a payment', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByTestId('page-title')).toHaveText(PROJECT);

    // BOQ import (CSV) with a preview
    await page.getByTestId('tab-boq').click();
    await page.getByTestId('boq-import').click();
    const csv = [
      'Item No,Description,Unit,Quantity,Rate',
      '1.1,Site clearance,m2,100,1000',
      '1.2,"Excavation, any soil",m3,200,"2,000"',
      '1.3,Concrete grade 25,m3,50,10000',
    ].join('\n');
    await page.getByTestId('boq-import-file').setInputFiles({
      name: 'boq.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page.getByTestId('boq-import-summary')).toContainText('3 items ready');
    await expect(page.getByTestId('boq-import-summary')).toContainText('Rs. 1,000,000.00');
    await page.getByTestId('boq-import-confirm').click();
    await expect(page.getByTestId('boq-row-1.3')).toBeVisible();

    // progress: all of 1.1 and a quarter of 1.2 → 200,000 of 1,000,000
    await page.getByTestId('record-progress').click();
    const record = page.getByTestId('record-progress-dialog');
    await record.getByTestId('progress-input-1.1').fill('100');
    await record.getByTestId('progress-input-1.2').fill('50');
    await record.getByTestId('record-progress-save').click();
    await expect(record).toBeHidden();
    await expect(page.getByTestId('physical-pct')).toHaveText('20%');
    await expect(page.getByTestId('boq-row-1.1').getByTestId('item-pct')).toHaveText('100%');

    // a new bill shows the calculation step by step
    await page.getByTestId('tab-bills').click();
    await page.getByTestId('new-bill').click();
    const bill = page.getByTestId('bill-dialog');
    await bill.getByTestId('bill-calculate').click();
    await expect(bill.getByTestId('calc-cumulative')).toHaveText('Rs. 200,000.00');
    await expect(bill.getByTestId('calc-previous')).toHaveText('− Rs. 0.00');
    await expect(bill.getByTestId('calc-gross')).toHaveText('Rs. 200,000.00');
    await expect(bill.getByTestId('calc-retention')).toHaveText('− Rs. 20,000.00');
    await expect(bill.getByTestId('calc-advance')).toHaveText('− Rs. 40,000.00');
    await expect(bill.getByTestId('calc-net')).toHaveText('Rs. 140,000.00');
    await bill.getByTestId('bill-save').click();
    await expect(bill).toBeHidden();
    const row = page.getByTestId('bill-row-1');
    await expect(row.getByTestId('bill-net')).toHaveText('140,000.00');

    // submit and certify → money to receive
    await row.getByTestId('bill-submit').click();
    await page.getByTestId('bill-status-save').click();
    await expect(row).toContainText('Submitted');
    await row.getByTestId('bill-certify').click();
    await page.getByTestId('bill-status-save').click();
    await expect(row).toContainText('Certified');
    await expect(page.getByTestId('summary-receivable')).toHaveText('Rs. 140,000.00');

    // a part payment lowers what is still to receive
    await page.getByTestId('record-payment').click();
    const pay = page.getByTestId('payment-dialog');
    await expect(pay.getByTestId('payment-amount')).toHaveValue('140000.00');
    await pay.getByTestId('payment-amount').fill('100000');
    await pay.getByTestId('payment-save').click();
    await expect(pay).toBeHidden();
    await expect(page.getByTestId('summary-receivable')).toHaveText('Rs. 40,000.00');
    await expect(page.getByTestId('summary-received')).toHaveText('Rs. 100,000.00');
    await expect(page.getByTestId('payments-table')).toContainText('Rs. 100,000.00');

    // the overview shows the three health bars
    await page.getByTestId('tab-overview').click();
    await expect(page.getByTestId('progress-triple')).toBeVisible();
    await expect(page.getByTestId('bar-physical')).toContainText('20%');
    expect(errors).toEqual([]);
  });

  test('Sinhala smoke: the payroll page', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/payroll');
    await setLocale(page, 'si');
    await expect(page.getByTestId('page-title')).toHaveText('වැටුප්');
    await expect(page.getByTestId('payroll-table')).toContainText('අතට ලැබෙන');
    await expect(page.getByTestId('generate-payroll')).toHaveText(/නැවත ගණනය කරන්න/);
    await setLocale(page, 'en');
    expect(errors).toEqual([]);
  });
});
