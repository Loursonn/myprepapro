import { useMemo } from "react";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import type { Session, Exercise, SetRow } from "../types/athlete";

export interface WorkoutDetail {
  session: Session | null;
  exercises: Array<{
    exercise: Exercise;
    /** sets[exId_week] */
    sets: SetRow[];
    /** done sets from the last week this exercise was actually performed */
    prevSets: SetRow[];
    /** which week prevSets came from, null if none found */
    prevWeekNum: number | null;
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

    const exercises = sessionExos.map((ex) => {
      // Search backwards to find the most recent week with done sets
      let prevSets: SetRow[] = [];
      let prevWeekNum: number | null = null;
      for (let w = currentWeek - 1; w >= 1; w--) {
        const candidate = ((sets[`${ex.id}_${w}`] ?? []) as SetRow[]).filter(s => s.done);
        if (candidate.length > 0) {
          prevSets = candidate;
          prevWeekNum = w;
          break;
        }
      }
      return {
        exercise: ex,
        sets: (sets[`${ex.id}_${currentWeek}`] ?? []) as SetRow[],
        prevSets,
        prevWeekNum,
      };
    });

    return {
      session,
      exercises,
      isCompleted: doneNow.has(sessionId),
      currentWeek,
    };
  }, [sessions, exos, sets, completedSessions, currentWeek, sessionId]);
}
