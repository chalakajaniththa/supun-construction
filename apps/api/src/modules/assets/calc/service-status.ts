import type { MeterType, ServiceState } from '@sc/shared';
import { type DecimalInput, dec } from '../../../common/money/money.js';

/** Share of the interval after which a service is "due soon" (overview §7: 90%). */
export const DUE_SOON_FRACTION = '0.9';

/**
 * Service status from the meter (overview §7): used = current − last service.
 * OVERDUE when used ≥ interval, DUE_SOON when used ≥ 90% of it, else OK.
 * NOT_TRACKED when the machine has no meter, no interval or no last-service reading.
 */
export function serviceStatus(input: {
  meterType: MeterType;
  currentMeter: DecimalInput;
  lastServiceMeter: DecimalInput | null | undefined;
  serviceIntervalMeter: DecimalInput | null | undefined;
}): { state: ServiceState; dueAt: string | null; remaining: string | null } {
  const interval = input.serviceIntervalMeter == null ? null : dec(input.serviceIntervalMeter);
  if (
    input.meterType === 'NONE' ||
    !interval ||
    interval.lte(0) ||
    input.lastServiceMeter === null ||
    input.lastServiceMeter === undefined
  ) {
    return { state: 'NOT_TRACKED', dueAt: null, remaining: null };
  }
  const last = dec(input.lastServiceMeter);
  const current = dec(input.currentMeter);
  const used = current.minus(last);
  const dueAt = last.plus(interval);
  const remaining = dueAt.minus(current);
  const state: ServiceState = used.gte(interval)
    ? 'OVERDUE'
    : used.gte(interval.times(DUE_SOON_FRACTION))
      ? 'DUE_SOON'
      : 'OK';
  return { state, dueAt: dueAt.toString(), remaining: remaining.toString() };
}
