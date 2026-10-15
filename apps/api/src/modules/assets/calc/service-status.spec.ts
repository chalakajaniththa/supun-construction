import { describe, expect, it } from 'vitest';
import { serviceStatus } from './service-status.js';

describe('serviceStatus', () => {
  const base = {
    meterType: 'HOURS' as const,
    serviceIntervalMeter: '250',
    lastServiceMeter: '1000',
  };

  it.each([
    ['1000', 'OK', '250'],
    ['1224.9', 'OK', '25.1'],
    ['1225', 'DUE_SOON', '25'],
    ['1249.999', 'DUE_SOON', '0.001'],
    ['1250', 'OVERDUE', '0'],
    ['1300', 'OVERDUE', '-50'],
  ])('current %s → %s (remaining %s)', (current, state, remaining) => {
    const r = serviceStatus({ ...base, currentMeter: current });
    expect(r.state).toBe(state);
    expect(r.remaining).toBe(remaining);
    expect(r.dueAt).toBe('1250');
  });

  it('works for km meters', () => {
    expect(
      serviceStatus({
        meterType: 'KM',
        currentMeter: '219600',
        lastServiceMeter: '215000',
        serviceIntervalMeter: '5000',
      }).state,
    ).toBe('DUE_SOON');
  });

  it.each([
    [{ meterType: 'NONE' as const }],
    [{ serviceIntervalMeter: null }],
    [{ serviceIntervalMeter: '0' }],
    [{ lastServiceMeter: null }],
  ])('is NOT_TRACKED for %j', (patch) => {
    const r = serviceStatus({ ...base, currentMeter: '1300', ...patch });
    expect(r).toEqual({ state: 'NOT_TRACKED', dueAt: null, remaining: null });
  });
});
