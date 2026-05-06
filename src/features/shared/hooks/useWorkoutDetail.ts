import { useMemo } from "react";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import type { Session, Exercise, SetRow } from "../types/athlete";

export interface WorkoutDetail {
  session: Session | null;
  exercises: Array<{
    exercise: Exercise;
    /** sets[exId_week] */
    sets: SetRow[];
    /** done sets from previous week — empty on week 1 */
    prevSets: SetRow[];
  }>;
  isCompleted: boolean;
  currentWeek: number;
}

/**
 * Full workout detail for a given session ID and the current block week.
 * Used by WorkoutDetailPage (/program/workout/:id).
 */
export function useWorkoutDetail(sessionId: string): WorkoutDetail {
  const { sessions, exos, sets, completedSessions, currentWeek } =
    useAthleteContext();

  return useMemo(() => {
    const session = sessions.find((s) => s.id === sessionId) ?? null;
    const sessionExos: Exercise[] = exos[sessionId] ?? [];
    const doneNow = new Set(completedSessions[currentWeek] ?? []);

    const prevWeek = currentWeek - 1;
    const exercises = sessionExos.map((ex) => ({
      exercise: ex,
      sets: (sets[`${ex.id}_${currentWeek}`] ?? []) as SetRow[],
      prevSets: prevWeek >= 1
        ? ((sets[`${ex.id}_${prevWeek}`] ?? []) as SetRow[]).filter(s => s.done)
        : [],
    }));

    return {
      session,
      exercises,
      isCompleted: doneNow.has(sessionId),
      currentWeek,
    };
  }, [sessions, exos, sets, completedSessions, currentWeek, sessionId]);
}
