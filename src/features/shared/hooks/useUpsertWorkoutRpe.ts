import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calBaseKey } from "./useUnifiedCalendar";
import { QK } from "@/lib/queryKeys";

export function useUpsertWorkoutRpe(athleteId: string, sessionId: string, scheduledDate?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rpeScore: number) => {
      const today = new Date().toISOString().split("T")[0];

      // Find the workout_log for this session+athlete.
      // When scheduledDate is known, target it exactly; otherwise fall back to most recent.
      // Retry up to 3x — syncWorkoutLogStatus is async and may not have committed yet.
      let logId: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
        let q = supabase
          .from("workout_logs")
          .select("id")
          .eq("athlete_id", athleteId)
          .eq("session_id", sessionId);
        if (scheduledDate) {
          q = q.eq("scheduled_date", scheduledDate);
        } else {
          q = q.order("scheduled_date", { ascending: false }).limit(1);
        }
        const { data } = await q.maybeSingle();
        if (data) { logId = data.id; break; }
      }

      // Fallback: syncWorkoutLogStatus may have been skipped (missing scheduledDate).
      if (!logId) {
        const { data: newLog, error: insertErr } = await supabase
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
        if (insertErr) throw insertErr;
        if (!newLog) throw new Error("Impossible de créer le log de séance");
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
      queryClient.invalidateQueries({ queryKey: QK.weeklyRetours(athleteId) });
      queryClient.invalidateQueries({ queryKey: QK.monthlyRetours(athleteId) });
      queryClient.invalidateQueries({ queryKey: ["wl-split"] });
      toast.success("RPE enregistré ✓");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur RPE : ${msg}`);
    },
  });
}
