import { useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AthleteModifications } from "../types/athlete";

const DEBOUNCE_MS = 600;

export function useSaveWorkoutSets(workoutLogId: string | undefined) {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const { mutate } = useMutation({
    mutationFn: async (modifications: AthleteModifications) => {
      if (!workoutLogId) return;
      // `.select()` permet de détecter le cas "0 ligne mise à jour" : sans lui,
      // un UPDATE sur une séance disparue (supprimée entre-temps) réussit
      // silencieusement et la saisie de l'athlète est perdue sans aucun signal.
      const { data, error } = await supabase
        .from("workout_logs")
        .update({
          athlete_modifications: modifications,
        })
        .eq("id", workoutLogId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Séance introuvable — saisie non enregistrée");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-log-detail", workoutLogId] });
    },
    onError: () => {
      toast.error("Saisie non enregistrée — vérifie ta connexion");
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
