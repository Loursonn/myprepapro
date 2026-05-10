import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";

export interface StartUnplannedInput {
  athleteId: string;
  coachId: string | null;
  sessionId: string;
  sessionName: string;
  /** Date choisie par l'athlète (YYYY-MM-DD) — today par défaut */
  scheduledDate: string;
  weekMondayISO: string;
}

/**
 * Insère un workout_log "non prévu" créé à l'initiative de l'athlète.
 * original_scheduled_date = scheduledDate (même date, mais l'athlète a choisi de faire cette séance).
 * rescheduled_by_athlete = true pour distinguer des logs planifiés par le coach.
 */
export function useStartUnplannedSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      athleteId, coachId, sessionId, sessionName, scheduledDate,
    }: StartUnplannedInput) => {
      const { data, error } = await supabase
        .from("workout_logs")
        .insert({
          athlete_id:              athleteId,
          coach_id:                coachId,
          session_id:              sessionId,
          session_name:            sessionName,
          scheduled_date:          scheduledDate,
          original_scheduled_date: scheduledDate,
          status:                  "planned",
          rescheduled_by_athlete:  true,
          coach_alert:             false,
        })
        .select("id, session_id, session_name, scheduled_date, status, rescheduled_by_athlete")
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data, { athleteId, weekMondayISO }) => {
      qc.invalidateQueries({ queryKey: QK.activePlan(athleteId) });
      qc.invalidateQueries({ queryKey: QK.workoutLogsWeek(athleteId, weekMondayISO) });
      toast.success(`Séance ajoutée : ${data.session_name}`);
    },

    onError: () => {
      toast.error("Impossible de démarrer cette séance");
    },
  });
}
