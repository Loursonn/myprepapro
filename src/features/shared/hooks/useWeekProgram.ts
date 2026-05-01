import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { supabase } from "@/integrations/supabase/client";
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
    workoutLogId?: string;
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
 *
 * Primary source: workout_logs (created by coach when assigning a cycle).
 * Fallback: day_of_week sessions from app_data (legacy).
 */
export function useWeekProgram(weekStart: string | null): DayProgram[] {
  const { sessions, exos, completedSessions, currentWeek, blockConfig, testSessions, athleteId } =
    useAthleteContext();

  // Compute week boundaries
  const { monday, sundayISO, mondayISO } = useMemo(() => {
    const d = weekStart ? new Date(weekStart + "T12:00:00") : new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setHours(0, 0, 0, 0);
    const mon = new Date(d);
    const sun = new Date(d);
    sun.setDate(d.getDate() + 6);
    return { monday: mon, mondayISO: localISO(mon), sundayISO: localISO(sun) };
  }, [weekStart]);

  // Fetch workout_logs for this week from Supabase
  const { data: workoutLogs = [] } = useQuery({
    queryKey: ["workout-logs-week", athleteId, mondayISO],
    enabled: !!athleteId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_logs")
        .select("id, session_id, session_name, scheduled_date, status")
        .eq("athlete_id", athleteId)
        .gte("scheduled_date", mondayISO)
        .lte("scheduled_date", sundayISO);
      return data ?? [];
    },
  });

  return useMemo(() => {
    // Index workout_logs by date
    const logsByDate = new Map<string, typeof workoutLogs>();
    for (const wl of workoutLogs) {
      const arr = logsByDate.get(wl.scheduled_date) ?? [];
      arr.push(wl);
      logsByDate.set(wl.scheduled_date, arr);
    }

    const hasWorkoutLogs = workoutLogs.length > 0;

    // Compute block week for legacy completed check
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

      let daySessions: DayProgram["sessions"];

      if (hasWorkoutLogs) {
        // Primary path: sessions from workout_logs
        const logsForDay = logsByDate.get(isoDate) ?? [];
        daySessions = logsForDay
          .map((wl) => {
            const exercises: Exercise[] = exos[wl.session_id] ?? [];
            // Look up full session object or build minimal one
            const session: Session = sessions.find((s) => s.id === wl.session_id) ?? {
              id: wl.session_id,
              name: wl.session_name,
              short: wl.session_name.slice(0, 3).toUpperCase(),
              day_of_week: dow,
            };
            return {
              session,
              exercises,
              isCompleted: wl.status === "completed" || doneThisWeek.has(wl.session_id),
              workoutLogId: wl.id,
            };
          })
          .filter((s) => s.exercises.length > 0);
      } else {
        // Fallback: legacy day_of_week sessions from app_data
        daySessions = sessions
          .filter((s) => s.day_of_week === dow && (exos[s.id] ?? []).length > 0)
          .map((s) => ({
            session:      s,
            exercises:    exos[s.id] ?? [],
            isCompleted:  doneThisWeek.has(s.id),
          }));
      }

      const dayTests = (testSessions as TestSess[]).filter((t) => t.date === isoDate);

      return { date: isoDate, dow, sessions: daySessions, tests: dayTests };
    });
  }, [sessions, exos, completedSessions, currentWeek, blockConfig, monday, testSessions, workoutLogs]);
}
