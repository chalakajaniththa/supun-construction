import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { type Observable, mergeMap } from 'rxjs';
import { ReminderScanner } from './reminder-scanner.service.js';

/** Changes under these paths can create or clear a reminder (expiry, meters, end dates, settings). */
const TRIGGER = /^\/(documents|bonds|projects|assets|daily-entry|settings)(\/|$|\?)/;

/**
 * After a successful change that may affect a reminder, re-runs the scan before answering, so the
 * bell is right straight away (e.g. a renewed insurance version clears its reminder).
 */
@Injectable()
export class ReminderTriggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ReminderTriggerInterceptor.name);

  constructor(private readonly scanner: ReminderScanner) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === 'GET' || !TRIGGER.test(req.path)) return next.handle();
    return next.handle().pipe(
      mergeMap(async (data: unknown) => {
        try {
          await this.scanner.run();
        } catch (err) {
          this.logger.warn(`Reminder scan after ${req.method} ${req.path} failed: ${String(err)}`);
        }
        return data;
      }),
    );
  }
}
