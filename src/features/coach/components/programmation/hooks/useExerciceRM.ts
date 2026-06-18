import { usePRsByRef } from "@/features/shared/hooks/usePRLogs"

export function useExerciceRM(athleteId: string | undefined, exerciseName: string) {
  const { bestByRef, byRef, isLoading } = usePRsByRef(athleteId)
  return {
    best: bestByRef[exerciseName] ?? null,
    history: byRef[exerciseName] ?? [],
    isLoading,
  }
}
