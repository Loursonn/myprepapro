import { useMemo } from "react";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useUnifiedCalendar } from "./useUnifiedCalendar";
import type { Session } from "../types/athlete";
import type { TestSess, DayProgram } from "./useWeekProgram";

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekBounds(weekStart: string | null): { start: string; end: string } {
  const monday = weekStart ? new Date(weekStart + "T12:00:00") : new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: localISO(monday), end: localISO(sunday) };
}

/**
 * Returns the 7-day schedule sourced from workout_logs.scheduled_date (date-based,
 * consistent with the coach's planning calendar). Backed by useUnifiedCalendar so
 * any mutation (assign/delete workout) auto-refreshes all calendar views.
 */
export function useWeekSchedule(weekStart: string | null): DayProgram[] {
  const { athleteId } = useAthleteContext();
  const range = useMemo(() => weekBounds(weekStart), [weekStart]);

  const { data: events = [] } = useUnifiedCalendar(athleteId, range, {
    includeExercises: true,
    staleTime: 30_000,
  });

  return useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(range.start + "T12:00:00");
      d.setDate(d.getDate() + i);
      const isoDate = localISO(d);
      const dow = i; // 0=Mon … 6=Sun

      const dayWorkouts = events.filter((e) => e.type === "workout" && e.date === isoDate);
      const dayTests    = events.filter((e) => e.type === "test"    && e.date === isoDate) as unknown as TestSess[];

      const daySessions = dayWorkouts.map((ev) => ({
        session: {
          id:          ev.sessionId ?? ev.id,
          name:        ev.title,
          short:       ev.title,
          day_of_week: dow,
        } as Session,
        exercises:   ev.exercises ?? [],
        isCompleted: ev.status === "completed",
      }));

      return { date: isoDate, dow, sessions: daySessions, tests: dayTests } satisfies DayProgram;
    });
  }, [events, range.start]);
}
