import { type CompanySettings, DEFAULT_SETTINGS } from '@sc/shared';
import type { PrismaClient } from '../generated/prisma/client.js';

/** Sample company details (fictional; overview §10). */
export const SAMPLE_COMPANY: CompanySettings = {
  ...DEFAULT_SETTINGS.company,
  name: 'Supun Construction (Pvt) Ltd',
  address: 'No. 45, Batticaloa Road, Kaduruwela, Polonnaruwa',
  phone: '027 222 3456',
  email: 'info@supunconstruction.example',
  cidaGrade: 'C5 (Building), C6 (Highways)',
};

/**
 * Sample data for a fresh install. Returns true when something was added. Step 1: company settings only. Later steps extend this file
 * (clients, projects, workers, assets, …). Only called when SEED_SAMPLE_DATA=true and there are
 * no projects yet.
 *
 * @param fresh true when the base seed just created the settings (a brand-new database). The
 *              company details are only replaced then, so the owner's own edits are never lost.
 */
export async function seedSampleData(
  prisma: PrismaClient,
  opts: { fresh: boolean },
): Promise<boolean> {
  if (opts.fresh) {
    await prisma.setting.update({
      where: { key: 'company' },
      data: { value: JSON.parse(JSON.stringify(SAMPLE_COMPANY)) },
    });
    return true;
  }
  return false;
}
