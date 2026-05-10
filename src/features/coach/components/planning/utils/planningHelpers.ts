import {
  format, parseISO,
  startOfISOWeek, endOfISOWeek,
  differenceInWeeks, addWeeks, addDays,
} from "date-fns";

// ── Snap ─────────────────────────────────────────────────────────────────────

/** Snap a date string to the Monday of its ISO week */
export function snapMonday(d: string): string {
  return format(startOfISOWeek(parseISO(d)), "yyyy-MM-dd");
}

/** Snap a date string to the Sunday of its ISO week */
export function snapSunday(d: string): string {
  return format(endOfISOWeek(parseISO(d)), "yyyy-MM-dd");
}

// ── Chain ────────────────────────────────────────────────────────────────────

/** Monday that follows prevEnd (used to chain consecutive blocks) */
export function chainNextStart(prevEnd: string): string {
  return format(startOfISOWeek(addDays(parseISO(prevEnd), 1)), "yyyy-MM-dd");
}

/** End date that preserves the same week-count as [origStart, origEnd], starting from newStart */
export function keepWeeks(newStart: string, origStart: string, origEnd: string): string {
  const n = Math.max(1, differenceInWeeks(parseISO(origEnd), parseISO(origStart)) + 1);
  return format(endOfISOWeek(addWeeks(parseISO(newStart), n - 1)), "yyyy-MM-dd");
}

/** End date = newStart + (weeks - 1) weeks, ending on Sunday */
export function endFromWeeks(newStart: string, weeks: number): string {
  return format(endOfISOWeek(addWeeks(parseISO(newStart), Math.max(1, weeks) - 1)), "yyyy-MM-dd");
}

// ── Cascade ──────────────────────────────────────────────────────────────────

export interface ShiftableItem {
  id: string;
  start_date: string;
  end_date: string;
}

/**
 * Compute cascaded start/end for each item in `later`,
 * chaining each after the previous end, preserving original week counts.
 */
export function computeCascade<T extends ShiftableItem>(
  newEnd: string,
  later: T[],
): Array<{ id: string; start_date: string; end_date: string }> {
  let prev = newEnd;
  return later.map((sib) => {
    const n = Math.max(1, differenceInWeeks(parseISO(sib.end_date), parseISO(sib.start_date)) + 1);
    const s = chainNextStart(prev);
    const e = endFromWeeks(s, n);
    prev = e;
    return { id: sib.id, start_date: s, end_date: e };
  });
}
