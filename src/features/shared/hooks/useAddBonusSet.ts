import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type { AthleteModifications, BonusSet, SetRow } from "@/features/shared/types/athlete";

export interface AddBonusSetInput {
  workoutLogId: string;
  athleteId: string;
  exerciseId: string;
  exerciseName: string;
  set: SetRow;
  weekMondayISO: string;
}

/**
 * Ajoute une série bonus sur un exercice existant dans athlete_modifications.
 * Ne touche PAS à app_data ni aux sets du système legacy → isolation surcharge progressive garantie.
 */
export function useAddBonusSet() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ workoutLogId, exerciseId, exerciseName, set }: AddBonusSetInput) => {
      // 1. Lire les modifications actuelles
      const { data: current, error: fetchErr } = await supabase
        .from("workout_logs")
        .select("athlete_modifications")
        .eq("id", workoutLogId)
        .single();

      if (fetchErr) throw fetchErr;

      const mods: AthleteModifications = (current?.athlete_modifications as AthleteModifications) ?? {};
      const bonusSets: BonusSet[] = mods.bonusSets ?? [];

      // 2. Trouver ou créer l'entrée pour cet exercice
      const existing = bonusSets.find((b) => b.exerciseId === exerciseId);
      let newBonusSets: BonusSet[];

      if (existing) {
        newBonusSets = bonusSets.map((b) =>
          b.exerciseId === exerciseId
            ? { ...b, sets: [...b.sets, set] }
            : b
        );
      } else {
        newBonusSets = [...bonusSets, { exerciseId, exerciseName, sets: [set] }];
      }

      const newMods: AthleteModifications = { ...mods, bonusSets: newBonusSets };

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
      toast.success("Série bonus ajoutée", { duration: 1500 });
    },

    onError: () => {
      toast.error("Impossible d'ajouter la série");
    },
  });
}
