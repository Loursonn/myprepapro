import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type { AthleteModifications, CustomExercise } from "@/features/shared/types/athlete";

export interface AddCustomExerciseInput {
  workoutLogId: string;
  athleteId: string;
  exercise: Omit<CustomExercise, "tempId">;
  weekMondayISO: string;
}

/**
 * Ajoute un exercice libre dans athlete_modifications.
 * Isolé de app_data → n'impacte PAS la surcharge progressive du programme prescrit.
 */
export function useAddCustomExercise() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ workoutLogId, exercise }: AddCustomExerciseInput) => {
      const { data: current, error: fetchErr } = await supabase
        .from("workout_logs")
        .select("athlete_modifications")
        .eq("id", workoutLogId)
        .single();

      if (fetchErr) throw fetchErr;

      const mods: AthleteModifications = (current?.athlete_modifications as AthleteModifications) ?? {};
      const customExercises: CustomExercise[] = mods.customExercises ?? [];

      const newEntry: CustomExercise = {
        ...exercise,
        tempId: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };

      const newMods: AthleteModifications = {
        ...mods,
        customExercises: [...customExercises, newEntry],
      };

      const { data, error } = await supabase
        .from("workout_logs")
        .update({ athlete_modifications: newMods as unknown as import("@/integrations/supabase/types").Json })
        .eq("id", workoutLogId)
        .select("id, athlete_modifications")
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (_, { athleteId, weekMondayISO }) => {
      qc.invalidateQueries({ queryKey: QK.workoutLogsWeek(athleteId, weekMondayISO) });
      toast.success("Exercice ajouté", { duration: 1500 });
    },

    onError: () => {
      toast.error("Impossible d'ajouter l'exercice");
    },
  });
}
