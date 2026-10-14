import { describe, expect, it } from 'vitest';
import { LoginRateLimiter } from './login-rate-limiter.js';

describe('LoginRateLimiter', () => {
  it('blocks after 10 failures within a minute and recovers after the window', () => {
    const limiter = new LoginRateLimiter(10, 60_000);
    const t0 = 1_000_000;
    for (let i = 0; i < 9; i++) limiter.recordFailure('ip', t0 + i);
    expect(limiter.isBlocked('ip', t0 + 10)).toBe(false);
    limiter.recordFailure('ip', t0 + 10);
    expect(limiter.isBlocked('ip', t0 + 11)).toBe(true);
    expect(limiter.retryAfterSeconds('ip', t0 + 11)).toBe(60);
    expect(limiter.isBlocked('ip', t0 + 60_001)).toBe(false);
  });

  it('keeps clients separate and resets on success', () => {
    const limiter = new LoginRateLimiter(2, 60_000);
    limiter.recordFailure('a', 0);
    limiter.recordFailure('a', 1);
    expect(limiter.isBlocked('a', 2)).toBe(true);
    expect(limiter.isBlocked('b', 2)).toBe(false);
    limiter.reset('a');
    expect(limiter.isBlocked('a', 3)).toBe(false);
  });
});
