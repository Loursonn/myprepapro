import { useMemo } from "react";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import type { Session, Exercise } from "../types/athlete";

export interface TodayWorkout {
  session: Session;
  exercises: Exercise[];
  isCompleted: boolean;
}

/** day_of_week: 0=Mon … 6=Sun (matches DashboardPage convention). */
function getTodayDow(): number {
  return (new Date().getDay() + 6) % 7;
}

/**
 * Derives today's scheduled workouts from AthleteContext.
 * Returns sessions whose day_of_week matches today, with their exercises.
 */
export function useTodayWorkout(): {
  workouts: TodayWorkout[];
  nextWorkout: TodayWorkout | null;
  allDoneToday: boolean;
} {
  const { sessions, exos, completedSessions, currentWeek } = useAthleteContext();

  return useMemo(() => {
    const dow = getTodayDow();
    const doneNow = new Set(completedSessions[currentWeek] ?? []);

    const todaySessions = sessions.filter(
      (s) => s.day_of_week === dow && (exos[s.id] ?? []).length > 0,
    );

    const workouts: TodayWorkout[] = todaySessions.map((s) => ({
      session:     s,
      exercises:   exos[s.id] ?? [],
      isCompleted: doneNow.has(s.id),
    }));

    const nextWorkout = workouts.find((w) => !w.isCompleted) ?? null;
    const allDoneToday = workouts.length > 0 && workouts.every((w) => w.isCompleted);

    return { workouts, nextWorkout, allDoneToday };
  }, [sessions, exos, completedSessions, currentWeek]);
}
