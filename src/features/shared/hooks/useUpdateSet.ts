import { useCallback, useRef } from "react";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { toast } from "sonner";
import type { SetRow } from "../types/athlete";

const DEBOUNCE_MS = 500;

/**
 * Mutation: update a set row with 500ms debounce (prevents rapid save storms
 * during continuous input like typing a weight).
 * The context's updSets is the optimistic write — it updates React state immediately.
 */
export function useUpdateSet() {
  const { updSets } = useAthleteContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutate = useCallback(
    (key: string, sets: SetRow[]) => {
      // Optimistic: update context immediately (React state re-render)
      updSets(key, sets);

      // Debounced toast (avoid spam on rapid keystroke)
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        toast.success("Série mise à jour", { duration: 1500 });
      }, DEBOUNCE_MS);
    },
    [updSets],
  );

  return { mutate };
}
