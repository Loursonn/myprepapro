import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calBaseKey } from "./useUnifiedCalendar";

export function useUpsertWorkoutRpe(athleteId: string, sessionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rpeScore: number) => {
      const today = new Date().toISOString().split("T")[0];

      // Find the most recent workout_log for this session+athlete.
      // Retry up to 3x — syncWorkoutLogStatus is async and may not have committed yet.
      let logId: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
        const { data } = await supabase
          .from("workout_logs")
          .select("id")
          .eq("athlete_id", athleteId)
          .eq("session_id", sessionId)
          .order("scheduled_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) { logId = data.id; break; }
      }

      // Fallback: syncWorkoutLogStatus may have been skipped (missing scheduledDate).
      if (!logId) {
        const { data: newLog } = await supabase
          .from("workout_logs")
          .insert({
            athlete_id:     athleteId,
            session_id:     sessionId,
            session_name:   "Séance",
            scheduled_date: today,
            status:         "completed",
          })
          .select("id")
          .single();
        if (!newLog) return;
        logId = newLog.id;
      }

      const { error } = await supabase
        .from("workout_logs")
        .update({ rpe_score: rpeScore })
        .eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calBaseKey(athleteId) });
    },
  });
}
