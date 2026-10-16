import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import type { Env } from '../../config/env.js';

/**
 * The node-postgres adapter. The session time zone is pinned to UTC: the adapter sends and reads
 * `timestamptz` values as UTC wall-clock text without an offset, so with the server's default
 * zone (Asia/Colombo in our containers) every instant was stored 5 h 30 min early and values
 * written by SQL `now()` (the backup container) were read 5 h 30 min late.
 */
export function pgAdapter(databaseUrl: string): PrismaPg {
  return new PrismaPg({ connectionString: databaseUrl, options: '-c timezone=UTC' });
}

/** Creates a Prisma client (Prisma 7 + driver adapter for node-postgres). Also used by the seed. */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: pgAdapter(databaseUrl) });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: pgAdapter(config.get('DATABASE_URL', { infer: true })),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
