import { useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AthleteModifications } from "../types/athlete";

const DEBOUNCE_MS = 600;

export function useSaveWorkoutSets(workoutLogId: string | undefined) {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const { mutate } = useMutation({
    mutationFn: async (modifications: AthleteModifications) => {
      if (!workoutLogId) return;
      const { error } = await supabase
        .from("workout_logs")
        .update({
          athlete_modifications: modifications,
        })
        .eq("id", workoutLogId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-log-detail", workoutLogId] });
    },
  });

  return useCallback(
    (modifications: AthleteModifications) => {
      if (!workoutLogId) return;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => mutate(modifications), DEBOUNCE_MS);
    },
    [workoutLogId, mutate]
  );
}
