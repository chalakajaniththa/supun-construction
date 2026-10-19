import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { login, setLocale } from './helpers';

/**
 * Makes the screenshots of the in-app user guide (/guide), in English and Sinhala, against the
 * running app with the sample data. Not part of the normal e2e run — start it on purpose:
 *
 *   GUIDE_SHOTS=1 pnpm --filter @sc/web exec playwright test guide-screenshots
 *
 * Needs ImageMagick (`magick`) to turn the PNGs into small WebP files in public/guide/<locale>/.
 * Every shot name used here must match a `shot` in src/components/guide/guide-content.ts
 * (a unit test checks that every shot the guide uses exists for both languages).
 */
test.skip(!process.env.GUIDE_SHOTS, 'Set GUIDE_SHOTS=1 to make the user-guide screenshots.');
test.use({ actionTimeout: 15_000 });

const OUT = 'public/guide';
const TMP = 'e2e/guide-shots';

interface Mark {
  target: Locator;
  label?: string;
}

/** Red rounded boxes (with an optional number) drawn over the elements the guide talks about. */
async function drawMarks(page: Page, marks: Mark[]) {
  const boxes: { x: number; y: number; w: number; h: number; label?: string }[] = [];
  for (const m of marks) {
    const box = await m.target.boundingBox();
    if (box) boxes.push({ x: box.x, y: box.y, w: box.width, h: box.height, label: m.label });
  }
  await page.evaluate((list) => {
    for (const b of list) {
      const pad = 5;
      const el = document.createElement('div');
      el.className = 'guide-mark';
      Object.assign(el.style, {
        position: 'fixed',
        left: `${b.x - pad}px`,
        top: `${b.y - pad}px`,
        width: `${b.w + pad * 2}px`,
        height: `${b.h + pad * 2}px`,
        border: '3px solid #e11d48',
        borderRadius: '10px',
        boxShadow: '0 0 0 4px rgba(225,29,72,0.18)',
        zIndex: '2147483647',
        pointerEvents: 'none',
      });
      if (b.label) {
        const badge = document.createElement('span');
        badge.textContent = b.label;
        Object.assign(badge.style, {
          position: 'absolute',
          // outside the top-left corner, or just inside it near the screen edge
          left: b.x - pad < 18 ? '4px' : '-16px',
          top: b.y - pad < 18 ? '4px' : '-16px',
          width: '28px',
          height: '28px',
          borderRadius: '9999px',
          background: '#e11d48',
          color: 'white',
          font: '700 15px/28px system-ui, sans-serif',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
        });
        el.appendChild(badge);
      }
      document.body.appendChild(el);
    }
  }, boxes);
}

async function clearMarks(page: Page) {
  await page.evaluate(() => document.querySelectorAll('.guide-mark').forEach((e) => e.remove()));
}

/** Hides things that are not part of the app (the Next.js dev-mode badge). */
async function hideDevTools(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await hideDevTools(page);
  // let animations (dialogs, toasts) finish
  await page.waitForTimeout(450);
}

for (const locale of ['en', 'si'] as const) {
  test(`user guide screenshots (${locale})`, async ({ page }) => {
    test.setTimeout(900_000);
    rmSync(`${TMP}/${locale}`, { recursive: true, force: true });
    mkdirSync(`${TMP}/${locale}`, { recursive: true });
    mkdirSync(`${OUT}/${locale}`, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    const failures: string[] = [];

    /** Takes one screenshot. `scrollTo` is centred first; `marks` are drawn on top. */
    async function shot(
      name: string,
      opts: {
        marks?: (Locator | Mark)[];
        scrollTo?: Locator;
        /** Put `scrollTo` at the top of the screen (below the top bar) instead of the middle. */
        top?: boolean;
        clip?: Locator;
      } = {},
    ) {
      const marks = (opts.marks ?? []).map((m) => ('target' in m ? m : { target: m }));
      const first = opts.scrollTo ?? marks[0]?.target;
      if (first) {
        await first.evaluate((el, top) => {
          if (!top) return el.scrollIntoView({ block: 'center', inline: 'nearest' });
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 84 });
        }, opts.top ?? false);
        await page.waitForTimeout(200);
      }
      await drawMarks(page, marks);
      const png = `${TMP}/${locale}/${name}.png`;
      if (opts.clip) {
        const box = (await opts.clip.boundingBox())!;
        const pad = 16;
        const vp = page.viewportSize()!;
        const x = Math.max(0, box.x - pad);
        const y = Math.max(0, box.y - pad);
        await page.screenshot({
          path: png,
          clip: {
            x,
            y,
            width: Math.min(vp.width - x, box.width + pad * 2),
            height: Math.min(vp.height - y, box.height + pad * 2),
          },
        });
      } else {
        await page.screenshot({ path: png });
      }
      await clearMarks(page);
      execFileSync('magick', [png, '-quality', '78', `${OUT}/${locale}/${name}.webp`]);
    }

    /** Runs one part; a failure is noted and the next part still runs. */
    async function part(name: string, fn: () => Promise<void>) {
      try {
        await fn();
      } catch (e) {
        failures.push(`${name}: ${(e as Error).message.split('\n')[0]}`);
        await page.keyboard.press('Escape').catch(() => {});
      }
    }

    async function open(path: string) {
      await page.goto(path);
      await expect(page.getByTestId('page-title')).toBeVisible();
      await settle(page);
    }

    const tid = (id: string) => page.getByTestId(id);

    // ── Logged out: the login page (in the right language) ──────────────────────────────
    await login(page);
    await setLocale(page, locale);
    await page.context().clearCookies({ name: 'sc_session' });
    await page.goto('/login');
    await settle(page);
    await part('login', () =>
      shot('login', {
        marks: [
          { target: page.locator('#username'), label: '1' },
          { target: page.locator('#password'), label: '2' },
          { target: tid('login-submit'), label: '3' },
        ],
      }),
    );
    await login(page);
    await setLocale(page, locale);

    // ids of sample records
    const first = async (path: string) => {
      const res = await page.request.get(`/api${path}`);
      const body = (await res.json()) as { items: { id: string }[] };
      return body.items[0]!.id;
    };
    const road = await first('/projects?search=Rural%20road');
    const house = await first('/projects?search=house');
    const worker = await first('/workers?type=DAILY&active=true');
    const asset = await first('/assets?search=JCB');
    const suppliers = (await (await page.request.get('/api/suppliers?pageSize=50')).json()) as {
      items: { id: string; balance?: string }[];
    };
    const supplier =
      suppliers.items.find((s) => s.balance && Number(s.balance) > 0)?.id ?? suppliers.items[0]!.id;

    // ── Getting started ─────────────────────────────────────────────────────────────────
    await open('/dashboard');
    await part('screen-tour', () =>
      shot('screen-tour', {
        marks: [
          { target: page.locator('aside nav'), label: '1' },
          { target: tid('language-toggle'), label: '2' },
          { target: tid('backup-dot'), label: '3' },
          { target: tid('bell'), label: '4' },
          { target: tid('user-menu'), label: '5' },
        ],
      }),
    );
    await part('help-button', () =>
      shot('help-button', {
        marks: [{ target: tid('help-button') }],
        clip: page.locator('header'),
      }),
    );
    await part('language', () =>
      shot('language', { marks: [tid('language-toggle')], clip: page.locator('header') }),
    );
    await part('dashboard-kpis', () =>
      shot('dashboard-kpis', {
        marks: [
          { target: tid('kpi-activeProjects'), label: '1' },
          { target: tid('kpi-workersToday'), label: '2' },
          { target: tid('kpi-spentThisMonth'), label: '3' },
          { target: tid('kpi-toReceive'), label: '4' },
        ],
      }),
    );
    await part('dashboard-attention', () =>
      shot('dashboard-attention', { marks: [tid('attention-list')] }),
    );
    await part('dashboard-projects', () =>
      shot('dashboard-projects', {
        scrollTo: tid('dashboard-projects'),
        top: true,
        marks: [tid('dashboard-project').first()],
      }),
    );
    await part('user-menu', async () => {
      await page.mouse.wheel(0, -5000);
      await tid('user-menu').click();
      await settle(page);
      await shot('user-menu', {
        marks: [
          { target: tid('menu-change-password'), label: '1' },
          { target: tid('logout'), label: '2' },
        ],
      });
      await page.keyboard.press('Escape');
    });
    await part('password', async () => {
      await open('/settings?tab=password');
      await shot('password', {
        marks: [
          { target: page.locator('input[type="password"]').nth(0), label: '1' },
          { target: page.locator('input[type="password"]').nth(1), label: '2' },
          { target: page.locator('input[type="password"]').nth(2), label: '3' },
          { target: page.locator('form button[type="submit"]').last(), label: '4' },
        ],
      });
    });

    // ── Daily entry ─────────────────────────────────────────────────────────────────────
    await part('daily-pick', async () => {
      // a fresh browser has no "last project", so the page starts empty
      await open('/daily');
      await shot('daily-pick', {
        marks: [
          { target: page.locator('#daily-date'), label: '1' },
          { target: page.locator('#daily-project'), label: '2' },
        ],
      });
    });
    await part('daily-attendance', async () => {
      await page.goto(`/daily?project=${road}`);
      await expect(tid('section-attendance')).toBeVisible();
      await settle(page);
      const statusGroup = tid('section-attendance').locator('[role="radiogroup"], [role="group"]');
      await shot('daily-attendance', {
        scrollTo: tid('section-attendance'),
        marks: [
          { target: tid('mark-all-present'), label: '1' },
          { target: tid('copy-yesterday'), label: '2' },
          { target: statusGroup.first(), label: '3' },
          { target: tid('section-attendance').getByRole('combobox').first(), label: '4' },
        ],
      });
    });
    await part('daily-machines', () =>
      shot('daily-machines', {
        scrollTo: tid('section-usage'),
        top: true,
        marks: [
          { target: tid('section-usage').getByRole('combobox').first(), label: '1' },
          { target: tid('section-usage').locator('input').nth(1), label: '2' },
          { target: tid('section-usage').locator('input').nth(3), label: '3' },
        ],
      }),
    );
    await part('daily-expenses', async () => {
      // one empty row shows the fields (nothing is saved)
      await tid('add-expense-row').click();
      await shot('daily-expenses', {
        scrollTo: tid('section-expenses'),
        marks: [
          { target: tid('section-expenses'), label: '1' },
          { target: tid('add-expense-row'), label: '2' },
        ],
      });
    });
    await part('daily-save', () =>
      shot('daily-save', {
        scrollTo: tid('daily-save'),
        marks: [
          { target: tid('daily-totals'), label: '1' },
          { target: tid('daily-save'), label: '2' },
        ],
      }),
    );
    await part('expenses-list', async () => {
      await open('/daily/expenses');
      await shot('expenses-list', {
        marks: [
          { target: tid('add-expense'), label: '1' },
          { target: page.locator('input[type="search"]').first(), label: '2' },
        ],
      });
      await tid('add-expense').click();
      await settle(page);
      await shot('expense-dialog', { marks: [{ target: tid('expense-save') }] });
      await page.keyboard.press('Escape');
    });

    // ── Projects ────────────────────────────────────────────────────────────────────────
    await part('projects-list', async () => {
      await open('/projects');
      await shot('projects-list', {
        marks: [
          { target: tid('new-project'), label: '1' },
          { target: page.locator('input[type="search"]').first(), label: '2' },
          { target: page.locator('tbody tr').first(), label: '3' },
        ],
      });
    });
    await part('project-form', async () => {
      await open('/projects/new');
      await shot('project-form', { marks: [{ target: page.locator('main form input').first() }] });
      await shot('project-form-save', {
        scrollTo: tid('form-submit'),
        marks: [{ target: tid('form-submit') }],
      });
    });
    await part('clients', async () => {
      await open('/projects/clients');
      await shot('clients', { marks: [{ target: tid('add-client') }] });
    });
    await part('project-overview', async () => {
      await open(`/projects/${road}`);
      await shot('project-overview', {
        marks: [
          { target: page.getByRole('tablist'), label: '1' },
          { target: tid('project-health'), label: '2' },
        ],
      });
      await shot('project-budget', {
        scrollTo: tid('budget-editor'),
        marks: [
          { target: tid('budget-editor').locator('input').first(), label: '1' },
          { target: tid('budget-save'), label: '2' },
        ],
      });
    });
    await part('project-costs', async () => {
      await open(`/projects/${road}?tab=costs`);
      await shot('project-costs', {
        marks: [
          { target: tid('costs-total'), label: '1' },
          { target: page.locator('[data-testid^="cost-cat-"]').first(), label: '2' },
        ],
      });
    });
    await part('project-boq', async () => {
      await open(`/projects/${road}?tab=boq`);
      await shot('project-boq', {
        marks: [
          { target: tid('boq-import'), label: '1' },
          { target: tid('boq-add-item'), label: '2' },
          { target: tid('record-progress'), label: '3' },
        ],
      });
      await tid('record-progress').click();
      await settle(page);
      await shot('boq-record', { marks: [{ target: tid('record-progress-save') }] });
      await page.keyboard.press('Escape');
    });
    await part('project-bills', async () => {
      await open(`/projects/${road}?tab=bills`);
      await shot('project-bills', {
        marks: [
          { target: tid('new-bill'), label: '1' },
          { target: tid('bills-table'), label: '2' },
        ],
      });
      if (await tid('new-bill').isEnabled()) {
        await tid('new-bill').click();
        await settle(page);
        await shot('bill-dialog', { marks: [{ target: tid('bill-calculate') }] });
        await page.keyboard.press('Escape');
        await settle(page);
      }
      await shot('project-payments', {
        scrollTo: tid('record-payment'),
        marks: [{ target: tid('record-payment') }],
      });
      await tid('record-payment').click();
      await settle(page);
      await shot('payment-dialog', { marks: [{ target: tid('payment-save') }] });
      await page.keyboard.press('Escape');
    });
    await part('project-variations', async () => {
      await open(`/projects/${road}?tab=variations`);
      await shot('project-variations', {
        marks: [
          { target: tid('add-variation'), label: '1' },
          { target: tid('add-eot'), label: '2' },
        ],
      });
    });
    await part('project-bonds', async () => {
      await open(`/projects/${road}?tab=bonds`);
      await shot('project-bonds', { marks: [{ target: tid('add-bond') }] });
    });
    await part('project-team', async () => {
      await open(`/projects/${road}?tab=team`);
      await shot('project-team', {});
    });
    await part('project-manual-progress', async () => {
      await open(`/projects/${house}`);
      await shot('project-manual-progress', { marks: [{ target: tid('manual-progress') }] });
    });

    // ── Schedule ────────────────────────────────────────────────────────────────────────
    await part('schedule', async () => {
      await open('/schedule');
      await shot('schedule', {
        marks: [
          { target: tid('week-prev'), label: '1' },
          { target: tid('week-next'), label: '2' },
          { target: tid('assign-open'), label: '3' },
          { target: tid('allocation-block').first(), label: '4' },
        ],
        scrollTo: page.getByTestId('page-title'),
      });
      await tid('assign-open').click();
      await settle(page);
      await shot('schedule-assign', { marks: [{ target: tid('assign-save') }] });
      await page.keyboard.press('Escape');
      await settle(page);
      await tid('allocation-block').first().click();
      await settle(page);
      await shot('schedule-change', {
        marks: [
          { target: tid('allocation-save'), label: '1' },
          { target: tid('allocation-cancel'), label: '2' },
        ],
      });
      await page.keyboard.press('Escape');
    });

    // ── Workers ─────────────────────────────────────────────────────────────────────────
    await part('workers-list', async () => {
      await open('/workers');
      await shot('workers-list', {
        marks: [
          { target: tid('new-worker'), label: '1' },
          { target: page.locator('tbody tr').first(), label: '2' },
        ],
      });
    });
    await part('worker-form', async () => {
      await open('/workers/new');
      await shot('worker-form', { marks: [{ target: page.locator('main form input').first() }] });
    });
    await part('worker-detail', async () => {
      await open(`/workers/${worker}`);
      await shot('worker-detail', {
        marks: [
          { target: page.getByRole('tablist'), label: '1' },
          { target: tid('edit-button'), label: '2' },
        ],
      });
      await open(`/workers/${worker}?tab=rates`);
      await shot('worker-rates', { marks: [{ target: tid('add-rate') }] });
      await tid('add-rate').click();
      await settle(page);
      await shot('worker-rate-dialog', { marks: [{ target: tid('rate-submit') }] });
      await page.keyboard.press('Escape');
      await open(`/workers/${worker}?tab=attendance`);
      await shot('worker-attendance', {
        marks: [
          { target: tid('attendance-calendar'), label: '1' },
          { target: tid('attendance-summary'), label: '2' },
        ],
      });
      await open(`/workers/${worker}?tab=advances`);
      await shot('worker-advances', { marks: [{ target: tid('add-advance') }] });
      await tid('add-advance').click();
      await settle(page);
      await shot('advance-dialog', { marks: [{ target: tid('advance-save') }] });
      await page.keyboard.press('Escape');
      await open(`/workers/${worker}?tab=payslips`);
      await shot('worker-payslips', { marks: [{ target: tid('payslips-table') }] });
    });

    // ── Payroll ─────────────────────────────────────────────────────────────────────────
    await part('payroll', async () => {
      await open('/payroll');
      await shot('payroll-month', {
        marks: [
          { target: tid('prev-month'), label: '1' },
          { target: tid('payroll-month'), label: '2' },
          { target: tid('next-month'), label: '3' },
        ],
      });
      const calc = tid('generate-payroll');
      if (!(await tid('payroll-table').isVisible())) {
        // a fresh sample: calculate this month's draft (dev data only)
        await calc.click();
        await expect(tid('payroll-table')).toBeVisible();
        await settle(page);
      }
      if (await calc.isVisible()) {
        await shot('payroll-draft', {
          marks: [
            { target: calc, label: '1' },
            { target: tid('finalize-payroll'), label: '2' },
          ],
        });
      }
      await shot('payroll-table', {
        scrollTo: tid('payroll-table'),
        top: true,
        marks: [{ target: tid('edit-line').first() }],
      });
      await tid('edit-line').first().click();
      await settle(page);
      await shot('payroll-line', { marks: [{ target: tid('line-save') }] });
      await page.keyboard.press('Escape');
      await settle(page);
      await tid('prev-month').click();
      await settle(page);
      await shot('payroll-finalized', {
        marks: [
          { target: tid('reopen-payroll'), label: '1' },
          { target: page.getByRole('button', { name: /PDF|Excel/ }).first(), label: '2' },
        ],
      });
    });

    // ── Machines & vehicles ─────────────────────────────────────────────────────────────
    await part('assets', async () => {
      await open('/assets');
      await shot('assets-list', { marks: [{ target: tid('new-asset') }] });
      await open('/assets/new');
      await shot('asset-form', { marks: [{ target: page.locator('main form input').first() }] });
      await open(`/assets/${asset}`);
      await shot('asset-detail', {
        marks: [
          { target: page.getByRole('tablist'), label: '1' },
          { target: tid('service-state').first(), label: '2' },
        ],
      });
      await open(`/assets/${asset}?tab=usage`);
      await shot('asset-usage', {
        scrollTo: page.getByTestId('page-title'),
        marks: [{ target: tid('usage-totals') }],
      });
      await open(`/assets/${asset}?tab=maintenance`);
      await shot('asset-maintenance', { marks: [{ target: tid('add-maintenance') }] });
      await tid('add-maintenance').click();
      await settle(page);
      await shot('maintenance-dialog', { marks: [{ target: tid('maintenance-save') }] });
      await page.keyboard.press('Escape');
      await open(`/assets/${asset}?tab=documents`);
      await shot('asset-documents', {
        marks: [
          { target: tid('upload-document'), label: '1' },
          { target: tid('document-panel'), label: '2' },
        ],
      });
    });

    // ── Purchases, store, suppliers ─────────────────────────────────────────────────────
    await part('purchases', async () => {
      await open('/purchases');
      await shot('purchases-list', {
        marks: [
          { target: page.getByRole('tablist'), label: '1' },
          { target: tid('add-purchase'), label: '2' },
        ],
      });
      await tid('add-purchase').click();
      await settle(page);
      await shot('purchase-dialog', {
        marks: [
          { target: tid('add-line'), label: '1' },
          { target: tid('purchase-save'), label: '2' },
        ],
      });
      await page.keyboard.press('Escape');
      await open('/purchases?tab=store');
      await shot('store', {
        marks: [
          { target: tid('stock-table'), label: '1' },
          { target: tid('issue-open').first(), label: '2' },
        ],
      });
      await tid('issue-open').first().click();
      await settle(page);
      await shot('issue-dialog', { marks: [{ target: tid('issue-save') }] });
      await page.keyboard.press('Escape');
      await open('/purchases?tab=materials');
      await shot('materials', { marks: [{ target: tid('add-material') }] });
    });
    await part('suppliers', async () => {
      await open('/suppliers');
      await shot('suppliers-list', { marks: [{ target: tid('add-supplier') }] });
      await open(`/suppliers/${supplier}?tab=statement`);
      await shot('supplier-statement', {
        marks: [
          { target: tid('supplier-owed'), label: '1' },
          { target: tid('add-payment'), label: '2' },
        ],
      });
      await tid('add-payment').click();
      await settle(page);
      await shot('supplier-payment', { marks: [{ target: tid('payment-save') }] });
      await page.keyboard.press('Escape');
    });

    // ── Documents & reminders ───────────────────────────────────────────────────────────
    await part('documents', async () => {
      await open('/documents');
      await expect(page.getByRole('tablist').first()).toBeVisible();
      await shot('documents', {
        marks: [
          { target: page.getByRole('tablist').first(), label: '1' },
          { target: tid('upload-document'), label: '2' },
        ],
      });
      await tid('upload-document').click();
      await settle(page);
      await shot('upload-dialog', {
        marks: [
          { target: tid('file-drop'), label: '1' },
          { target: tid('upload-submit'), label: '2' },
        ],
      });
      await page.keyboard.press('Escape');
      await settle(page);
      await shot('document-actions', {
        marks: [
          { target: tid('new-version-button').first(), label: '1' },
          { target: tid('history-button').first(), label: '2' },
        ],
      });
      await tid('new-version-button').first().click();
      await settle(page);
      await shot('version-dialog', { marks: [{ target: tid('version-submit') }] });
      await page.keyboard.press('Escape');
      await settle(page);
      await tid('history-button').first().click();
      await settle(page);
      await shot('history-sheet', { marks: [{ target: tid('version-list') }] });
      await page.keyboard.press('Escape');
      await open('/documents?tab=all');
      await shot('documents-all', {
        marks: [
          { target: page.locator('input[type="search"]').first(), label: '1' },
          { target: tid('filter-expiring'), label: '2' },
        ],
      });
    });
    await part('reminders', async () => {
      await open('/dashboard');
      await tid('bell').click();
      await settle(page);
      await shot('bell', {
        marks: [
          { target: tid('bell'), label: '1' },
          { target: tid('bell-see-all'), label: '2' },
        ],
      });
      await page.keyboard.press('Escape');
      await open('/notifications');
      await shot('notifications', { marks: [{ target: tid('notif-list') }] });
    });

    // ── Reports ─────────────────────────────────────────────────────────────────────────
    await part('reports', async () => {
      await open('/reports');
      await shot('reports', { marks: [{ target: tid('report-cards') }] });
      await tid('report-project-cost').click();
      await settle(page);
      await shot('report-panel', { scrollTo: tid('report-panel'), marks: [tid('report-panel')] });
    });

    // ── Settings & backup ───────────────────────────────────────────────────────────────
    await part('settings', async () => {
      await open('/settings');
      await shot('settings-company', { marks: [{ target: page.getByRole('tablist') }] });
      await open('/settings?tab=payroll');
      await shot('settings-payroll', {});
      await open('/settings?tab=reminders');
      await shot('settings-reminders', {});
      await open('/settings?tab=backup');
      await shot('backup', {
        marks: [
          { target: tid('backup-status-card'), label: '1' },
          { target: tid('backup-now'), label: '2' },
        ],
      });
      await shot('backup-drive', {
        scrollTo: tid('backup-drive-card'),
        marks: [{ target: tid('gdrive-connect') }],
      });
      // the Google sign-in step (needs the backup service; cancelled again, nothing is connected)
      if (await tid('gdrive-connect').isEnabled()) {
        await tid('gdrive-connect').click();
        await expect(tid('gdrive-open-signin')).toBeVisible({ timeout: 30_000 });
        await settle(page);
        await shot('gdrive-signin', {
          scrollTo: tid('gdrive-waiting'),
          marks: [{ target: tid('gdrive-open-signin') }],
        });
        await tid('gdrive-waiting').getByRole('button').click();
        await expect(tid('gdrive-connect')).toBeVisible({ timeout: 30_000 });
      }
      await open('/settings?tab=sampleData');
      await shot('sample-data', {
        marks: [
          { target: tid('reset-empty-open'), label: '1' },
          { target: tid('reset-open'), label: '2' },
        ],
      });
      // the confirmation (cancelled — nothing is deleted)
      await tid('reset-empty-open').click();
      await settle(page);
      await shot('reset-dialog', {
        marks: [
          { target: tid('reset-confirm'), label: '1' },
          { target: tid('reset-password'), label: '2' },
          { target: tid('reset-submit'), label: '3' },
        ],
      });
      await page.keyboard.press('Escape');
    });

    expect(failures).toEqual([]);
  });
}
