import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { ConfigService } from '@nestjs/config';
import { createPrismaClient } from '../common/prisma/prisma.service.js';
import { StorageService } from '../common/storage/storage.service.js';
import { DATA_MODE_SETTING_KEY } from '@sc/shared';
import { validateEnv } from '../config/env.js';
import { seedBase } from './base.js';
import { seedSampleData } from './sample-data.js';

/**
 * Container start: `prisma migrate deploy && node dist/seed/index.js && node dist/main.js`.
 * 1. base seed (admin + default settings) — always, idempotent
 * 2. sample data — only when SEED_SAMPLE_DATA=true, the DB has no projects and the owner did not
 *    choose "start empty" in Settings (Setting `dataMode` = EMPTY)
 *    (clients, projects + budgets, workers + rates, assets, suppliers, materials, documents)
 */
export async function runSeed(): Promise<void> {
  const env = validateEnv(process.env);
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const base = await seedBase(prisma, {
      adminUsername: env.ADMIN_USERNAME,
      adminPassword: env.ADMIN_PASSWORD,
    });
    console.warn(
      `[seed] base: admin ${base.adminCreated ? 'created' : 'exists'}; settings created: ${
        base.createdSettings.join(', ') || 'none'
      }`,
    );
    const dataMode = await prisma.setting.findUnique({ where: { key: DATA_MODE_SETTING_KEY } });
    const startedEmpty = (dataMode?.value as { mode?: string } | null)?.mode === 'EMPTY';
    if (env.SEED_SAMPLE_DATA && startedEmpty) {
      console.warn('[seed] sample data skipped (the owner chose to start empty)');
    } else if (env.SEED_SAMPLE_DATA) {
      const projects = await prisma.project.count();
      if (projects === 0) {
        const storage = new StorageService(new ConfigService(env));
        await storage.ensureBucket();
        const loaded = await seedSampleData(prisma, {
          fresh: base.createdSettings.includes('company'),
          storage,
        });
        storage.onModuleDestroy();
        console.warn(
          loaded ? '[seed] sample data loaded' : '[seed] sample data: nothing new to add',
        );
      } else {
        console.warn('[seed] sample data skipped (projects already exist)');
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runSeed().catch((err: unknown) => {
    console.error('[seed] failed', err);
    process.exit(1);
  });
}
