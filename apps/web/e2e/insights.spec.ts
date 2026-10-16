import { statSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';
import { login, openPickerSearch, setLocale, trackErrors } from './helpers';

/** Step 5 flows: dashboard, reminders (bell → entity), report downloads, Sinhala smoke. */

async function unreadCount(page: Page): Promise<{ unread: number; open: number }> {
  const res = await page.request.get('/api/notifications/count');
  expect(res.ok()).toBe(true);
  return res.json();
}

/** Opens an EntityPicker by its trigger and picks the option with this text. */
async function pick(page: Page, triggerId: string, text: string) {
  await page.locator(`#${triggerId}`).click();
  await openPickerSearch(page).fill(text);
  await page
    .getByRole('option', { name: new RegExp(text) })
    .first()
    .click();
}

test.describe.serial('dashboard, reminders and reports', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await setLocale(page, 'en');
  });

  test('the dashboard shows 4 KPIs, attention items, projects and the chart', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/dashboard');
    for (const id of ['activeProjects', 'workersToday', 'spentThisMonth', 'toReceive']) {
      await expect(page.getByTestId(`kpi-${id}-value`)).toBeVisible();
    }
    await expect(page.getByTestId('kpi-toReceive-value')).toHaveText(/^Rs\. [\d,]+$/);
    expect(Number(await page.getByTestId('kpi-activeProjects-value').innerText())).toBeGreaterThan(
      0,
    );
    const items = page.getByTestId('attention-item');
    await expect(items.first()).toBeVisible();
    expect(await items.count()).toBeLessThanOrEqual(8);
    await expect(page.getByTestId('dashboard-project').first()).toBeVisible();
    await expect(page.getByTestId('spend-chart')).toBeVisible();
    await expect(page.getByTestId('dashboard-greeting')).toContainText('Today is');
    expect(errors).toEqual([]);
  });

  test('the bell count matches the reminders list', async ({ page }) => {
    const count = await unreadCount(page);
    expect(count.open).toBeGreaterThan(0);
    await page.goto('/dashboard');
    if (count.unread > 0) {
      await expect(page.getByTestId('bell-count')).toHaveText(String(Math.min(count.unread, 99)));
    } else {
      await expect(page.getByTestId('bell-count')).toHaveCount(0);
    }
    await page.goto('/notifications');
    await expect(page.getByTestId('notif-item')).toHaveCount(Math.min(count.open, 25));
    await page.getByTestId('bell').click();
    await expect(page.getByTestId('bell-panel')).toBeVisible();
    await expect(page.getByTestId('bell-item')).toHaveCount(Math.min(count.open, 8));
  });

  test('opening a reminder lands on the thing it is about and marks it seen', async ({ page }) => {
    // make sure the first one is unread
    const list = await (await page.request.get('/api/notifications?pageSize=1')).json();
    const first = list.items[0];
    expect(first).toBeDefined();
    const before = await unreadCount(page);
    await page.goto('/dashboard');
    await page.getByTestId('bell').click();
    await page.getByTestId('bell-item').first().click();
    await expect(page).toHaveURL(
      /\/(assets|projects|workers|suppliers)\/[0-9a-f-]{36}|\/documents/,
    );
    await expect(page.getByTestId('page-title')).toBeVisible();
    if (first.entityType === 'DOCUMENT' && first.params.ownerType === 'ASSET') {
      await expect(page).toHaveURL(/tab=documents/);
      await expect(page.getByTestId('tab-documents')).toHaveAttribute('data-state', 'active');
    }
    const after = await unreadCount(page);
    expect(after.unread).toBe(first.readAt ? before.unread : before.unread - 1);
  });

  test('R1 project cost PDF downloads from the Reports page', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByTestId('report-cards').getByRole('button')).toHaveCount(11);
    await page.getByTestId('report-project-cost').click();
    await expect(page.getByTestId('report-panel')).toBeVisible();
    await pick(page, 'f-project', 'Rural road');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-project-cost-pdf').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^project-cost_PRJ-2026-001_.*\.pdf$/);
    expect(statSync((await download.path())!).size).toBeGreaterThan(1000);
  });

  test('R2 salary sheet Excel downloads (last month, from Payroll and Reports)', async ({
    page,
  }) => {
    await page.goto('/reports');
    await page.getByTestId('report-payroll-sheet').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-payroll-sheet-xlsx').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^payroll-sheet_\d{4}-\d{2}\.xlsx$/);
    expect(statSync((await download.path())!).size).toBeGreaterThan(1000);
  });

  test('a report with a missing filter asks for it instead of downloading', async ({ page }) => {
    await page.goto('/reports');
    await page.getByTestId('report-ipc').click();
    await page.getByTestId('download-ipc-pdf').click();
    await expect(page.getByText(/Please choose: Project, Bill \(IPC\)/)).toBeVisible();
  });

  test('Sinhala: the dashboard, reminders and reports are translated', async ({ page }) => {
    const errors = trackErrors(page);
    await setLocale(page, 'si');
    await page.goto('/dashboard');
    await expect(page.getByTestId('page-title')).toHaveText('මුල් පිටුව');
    await expect(page.getByTestId('kpi-toReceive')).toContainText('ලැබිය යුතු මුදල්');
    await expect(page.getByText('අවධානය යොමු කළ යුතු දේ')).toBeVisible();
    await page.goto('/notifications');
    await expect(page.getByTestId('page-title')).toHaveText('මතක් කිරීම්');
    await expect(page.getByTestId('notif-item').first()).toBeVisible();
    await page.goto('/reports');
    await expect(page.getByTestId('report-expiry')).toContainText('කල් ඉකුත් වන ලේඛන සහ ඇපකර');
    await page.getByTestId('report-expiry').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-expiry-pdf').click(),
    ]);
    expect(statSync((await download.path())!).size).toBeGreaterThan(1000);
    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.screenshot({
        path: `e2e/screenshots/step5-si-${width}-dashboard.png`,
        fullPage: true,
      });
      await page.goto('/reports');
      await page.getByTestId('report-project-cost').click();
      await page.screenshot({ path: `e2e/screenshots/step5-si-${width}-report-panel.png` });
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('report-panel')).toHaveCount(0);
    }
    await setLocale(page, 'en');
    expect(errors).toEqual([]);
  });
});
