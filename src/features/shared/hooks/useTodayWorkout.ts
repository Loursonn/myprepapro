import { useMemo } from "react";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import type { Session, Exercise } from "../types/athlete";
import type { TestSess } from "./useWeekProgram";

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
 * Derives today's scheduled workouts + tests from AthleteContext.
 */
export function useTodayWorkout(): {
  workouts: TodayWorkout[];
  nextWorkout: TodayWorkout | null;
  allDoneToday: boolean;
  todayTests: TestSess[];
} {
  const { sessions, exos, completedSessions, currentWeek, testSessions } = useAthleteContext();

  return useMemo(() => {
    const dow = getTodayDow();
    const doneNow = new Set(completedSessions[currentWeek] ?? []);
    const d = new Date();
    const todayISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

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
    const todayTests = (testSessions as TestSess[]).filter((t) => t.date === todayISO);

    return { workouts, nextWorkout, allDoneToday, todayTests };
  }, [sessions, exos, completedSessions, currentWeek, testSessions]);
}
