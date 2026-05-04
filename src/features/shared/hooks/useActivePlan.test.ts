import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { weeksBetween, currentWeekOf, timeProgressPct } from "./useActivePlan";

describe("weeksBetween", () => {
  it("returns 1 for same-week dates", () => {
    expect(weeksBetween("2025-01-06", "2025-01-12")).toBe(1);
  });
  it("returns correct count for multi-week range", () => {
    expect(weeksBetween("2025-01-06", "2025-02-02")).toBe(4);
  });
  it("never returns 0", () => {
    expect(weeksBetween("2025-01-06", "2025-01-06")).toBe(1);
  });
});

describe("currentWeekOf", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 1 on the start date", () => {
    vi.setSystemTime(new Date("2025-03-10T12:00:00"));
    expect(currentWeekOf("2025-03-10", 6)).toBe(1);
  });
  it("returns 2 after 7 days", () => {
    vi.setSystemTime(new Date("2025-03-17T12:00:00"));
    expect(currentWeekOf("2025-03-10", 6)).toBe(2);
  });
  it("clamps to totalWeeks", () => {
    vi.setSystemTime(new Date("2025-06-01T12:00:00"));
    expect(currentWeekOf("2025-03-10", 6)).toBe(6);
  });
  it("clamps to 1 if before start", () => {
    vi.setSystemTime(new Date("2025-03-01T12:00:00"));
    expect(currentWeekOf("2025-03-10", 6)).toBe(1);
  });
});

describe("timeProgressPct", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 at start date", () => {
    vi.setSystemTime(new Date("2025-03-10T12:00:00"));
    expect(timeProgressPct("2025-03-10", "2025-04-07")).toBe(0);
  });
  it("returns 100 at or after end date", () => {
    vi.setSystemTime(new Date("2025-04-08T12:00:00"));
    expect(timeProgressPct("2025-03-10", "2025-04-07")).toBe(100);
  });
  it("returns ~50 at midpoint", () => {
    // start=Jan 1, end=Jan 29 (28 days), mid=Jan 15 (14 days = 50%)
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const pct = timeProgressPct("2025-01-01", "2025-01-29");
    expect(pct).toBeGreaterThanOrEqual(48);
    expect(pct).toBeLessThanOrEqual(52);
  });
  it("handles equal start/end without division by zero", () => {
    vi.setSystemTime(new Date("2025-01-01T12:00:00"));
    expect(timeProgressPct("2025-01-01", "2025-01-01")).toBe(100);
  });
});
