import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createPrismaClient } from '../common/prisma/prisma.service.js';
import { validateEnv } from '../config/env.js';
import { seedBase } from './base.js';
import { seedSampleData } from './sample-data.js';

/**
 * Container start: `prisma migrate deploy && node dist/seed/index.js && node dist/main.js`.
 * 1. base seed (admin + default settings) — always, idempotent
 * 2. sample data — only when SEED_SAMPLE_DATA=true and the DB has no projects
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
    if (env.SEED_SAMPLE_DATA) {
      const projects = await prisma.project.count();
      if (projects === 0) {
        const loaded = await seedSampleData(prisma, {
          fresh: base.createdSettings.includes('company'),
        });
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
