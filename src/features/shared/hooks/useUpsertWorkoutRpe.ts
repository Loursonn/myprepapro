import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calBaseKey } from "./useUnifiedCalendar";

export function useUpsertWorkoutRpe(athleteId: string, sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rpeScore: number) => {
      // Find the most recent workout_log for this session+athlete
      const { data: log } = await supabase
        .from("workout_logs")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("session_id", sessionId)
        .order("scheduled_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!log) return; // No planned log found, skip silently

      const { error } = await supabase
        .from("workout_rpe")
        .upsert(
          { workout_id: log.id, athlete_id: athleteId, rpe_score: rpeScore },
          { onConflict: "workout_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calBaseKey(athleteId) });
    },
  });
}
