import { differenceInDays, parseISO, addDays, format } from "date-fns";

export interface Position { x: number; width: number }

export function useCalculatePosition(
  rangeStart: Date,
  rangeEnd: Date,
  containerWidth: number,
) {
  const totalDays   = differenceInDays(rangeEnd, rangeStart) + 1;
  const pixPerDay   = containerWidth / totalDays;
  const minWidth    = Math.max(pixPerDay, 8); // at least 1-day width visible

  function dateToX(dateStr: string): number {
    const d = parseISO(dateStr);
    return Math.max(0, differenceInDays(d, rangeStart)) * pixPerDay;
  }

  function position(startStr: string, endStr: string): Position {
    const x = dateToX(startStr);
    const days = Math.max(1, differenceInDays(parseISO(endStr), parseISO(startStr)));
    return { x, width: Math.max(days * pixPerDay, minWidth) };
  }

  function xToDate(x: number): Date {
    const days = Math.round(x / pixPerDay);
    return addDays(rangeStart, Math.max(0, Math.min(days, totalDays - 1)));
  }

  function xToDateStr(x: number): string {
    return format(xToDate(x), "yyyy-MM-dd");
  }

  function clampToParent(
    x: number,
    width: number,
    parentStart: string,
    parentEnd: string,
  ): { x: number; width: number } {
    const pStart = dateToX(parentStart);
    const pWidth = position(parentStart, parentEnd).width;
    const clampedX = Math.max(pStart, Math.min(x, pStart + pWidth - width));
    const clampedW = Math.min(width, pWidth);
    return { x: clampedX, width: clampedW };
  }

  return { dateToX, position, xToDate, xToDateStr, clampToParent, pixPerDay, totalDays };
}
