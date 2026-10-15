import { colomboInstant, daysBetween, weekdayOf } from '@sc/shared';

/** A planned time slot for one worker / asset. */
export interface Slot {
  resourceId: string;
  start: Date;
  end: Date;
}

export interface ExistingBooking {
  id: string;
  resourceId: string;
  startAt: Date;
  endAt: Date;
}

/**
 * One slot per day per resource for a day range and a daily time window (Asia/Colombo).
 * `skipSundays` leaves Sundays out — but never when the range is a single day.
 */
export function buildSlots(input: {
  resourceIds: readonly string[];
  fromDate: string;
  toDate?: string | null;
  startTime: string;
  endTime: string;
  skipSundays?: boolean;
}): Slot[] {
  const to = input.toDate ?? input.fromDate;
  let days = daysBetween(input.fromDate, to);
  if (input.skipSundays && days.length > 1) days = days.filter((d) => weekdayOf(d) !== 0);
  const ids = [...new Set(input.resourceIds)];
  const slots: Slot[] = [];
  for (const resourceId of ids) {
    for (const day of days) {
      slots.push({
        resourceId,
        start: colomboInstant(day, input.startTime),
        end: colomboInstant(day, input.endTime),
      });
    }
  }
  return slots;
}

/** Half-open intervals [start, end) overlap. Back-to-back (10–12, 12–14) does not. */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** Every (requested slot, existing booking) pair of the same resource that overlaps. */
export function findConflicts(
  slots: readonly Slot[],
  existing: readonly ExistingBooking[],
): { slot: Slot; booking: ExistingBooking }[] {
  const byResource = new Map<string, ExistingBooking[]>();
  for (const b of existing) {
    const list = byResource.get(b.resourceId) ?? [];
    list.push(b);
    byResource.set(b.resourceId, list);
  }
  const out: { slot: Slot; booking: ExistingBooking }[] = [];
  for (const slot of slots) {
    for (const booking of byResource.get(slot.resourceId) ?? []) {
      if (overlaps(slot.start, slot.end, booking.startAt, booking.endAt))
        out.push({ slot, booking });
    }
  }
  return out;
}

/** The time window [min start, max end] covering all slots (for one DB query). */
export function slotWindow(slots: readonly Slot[]): { from: Date; to: Date } | null {
  if (!slots.length) return null;
  let from = slots[0]!.start;
  let to = slots[0]!.end;
  for (const s of slots) {
    if (s.start < from) from = s.start;
    if (s.end > to) to = s.end;
  }
  return { from, to };
}
