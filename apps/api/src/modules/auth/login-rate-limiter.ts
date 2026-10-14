import { Injectable } from '@nestjs/common';

export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_WINDOW_MS = 60_000;

/**
 * Simple in-memory limiter: at most 10 failed login attempts per minute per client IP.
 * A successful login clears the counter. (Single API instance, so memory is enough.)
 */
@Injectable()
export class LoginRateLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly maxFailures = LOGIN_MAX_FAILURES,
    private readonly windowMs = LOGIN_WINDOW_MS,
  ) {}

  private recent(key: string, now: number): number[] {
    const list = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
    return list;
  }

  isBlocked(key: string, now = Date.now()): boolean {
    return this.recent(key, now).length >= this.maxFailures;
  }

  /** Seconds until the oldest failure leaves the window. */
  retryAfterSeconds(key: string, now = Date.now()): number {
    const list = this.recent(key, now);
    if (!list.length) return 0;
    return Math.max(1, Math.ceil((list[0]! + this.windowMs - now) / 1000));
  }

  recordFailure(key: string, now = Date.now()): void {
    const list = this.recent(key, now);
    list.push(now);
    this.failures.set(key, list);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}
