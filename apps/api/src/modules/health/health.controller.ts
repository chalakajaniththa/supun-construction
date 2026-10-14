import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/auth/public.decorator.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { StorageService } from '../../common/storage/storage.service.js';

type Check = 'ok' | 'down';

export interface HealthResponse {
  status: 'ok' | 'error';
  db: Check;
  storage: Check;
  time: string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Public. 200 when the database and storage answer, 503 otherwise. */
  @Public()
  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const [db, storage] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(
        (): Check => 'ok',
        (): Check => 'down',
      ),
      this.storage.ping().then(
        (): Check => 'ok',
        (): Check => 'down',
      ),
    ]);
    const ok = db === 'ok' && storage === 'ok';
    res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? 'ok' : 'error', db, storage, time: new Date().toISOString() };
  }
}
