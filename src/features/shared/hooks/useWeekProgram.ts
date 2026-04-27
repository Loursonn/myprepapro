import { useMemo } from "react";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import type { Session, Exercise } from "../types/athlete";

export interface TestSess {
  id: string;
  type: string;
  title: string;
  date: string;
  completed: boolean;
}

export interface DayProgram {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** 0=Mon … 6=Sun */
  dow: number;
  sessions: Array<{
    session: Session;
    exercises: Exercise[];
    isCompleted: boolean;
  }>;
  tests: TestSess[];
}

/** Format local date as YYYY-MM-DD without UTC conversion. */
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Returns the 7-day programme for a given ISO week start (Monday).
 * Falls back to current week if weekStart is null.
 */
export function useWeekProgram(weekStart: string | null): DayProgram[] {
  const { sessions, exos, completedSessions, currentWeek, blockConfig, testSessions } =
    useAthleteContext();

  return useMemo(() => {
    // Derive the week's Monday in local time
    const monday = (() => {
      const d = weekStart ? new Date(weekStart + "T12:00:00") : new Date();
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    // Compute which block week this calendar week corresponds to
    let blockWeek = currentWeek;
    if (blockConfig?.startDate) {
      const tw = blockConfig.totalWeeks || 6;
      const refMonday = (() => {
        const d = new Date(blockConfig.startDate + "T12:00:00");
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        d.setHours(0, 0, 0, 0);
        return d;
      })();
      const days = Math.floor((monday.getTime() - refMonday.getTime()) / 86400000);
      blockWeek = Math.min(Math.max(1, Math.floor(days / 7) + 1), tw);
    }
    const doneThisWeek = new Set(completedSessions[blockWeek] ?? []);

    return Array.from({ length: 7 }, (_, i) => {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const dow = i; // 0=Mon … 6=Sun
      const isoDate = localISO(dayDate);

      const daysSessions = sessions
        .filter((s) => s.day_of_week === dow && (exos[s.id] ?? []).length > 0)
        .map((s) => ({
          session:     s,
          exercises:   exos[s.id] ?? [],
          isCompleted: doneThisWeek.has(s.id),
        }));

      const dayTests = (testSessions as TestSess[]).filter((t) => t.date === isoDate);

      return { date: isoDate, dow, sessions: daysSessions, tests: dayTests };
    });
  }, [sessions, exos, completedSessions, currentWeek, blockConfig, weekStart, testSessions]);
}
