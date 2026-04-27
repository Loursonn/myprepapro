import { useCallback } from "react";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { toast } from "sonner";
import type { WellnessData } from "../types/athlete";

/**
 * Mutation: log today's wellness.
 * Wraps context.saveWellness with toast feedback.
 * The context already updates state immediately (optimistic from the caller's perspective).
 */
export function useLogWellness() {
  const { saveWellness } = useAthleteContext();

  const mutate = useCallback(
    (data: WellnessData) => {
      try {
        saveWellness(data);
        toast.success("Wellness enregistré !");
      } catch {
        toast.error("Erreur lors de l'enregistrement");
      }
    },
    [saveWellness],
  );

  return { mutate };
}
