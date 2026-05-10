import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type { AthleteModifications } from "@/features/shared/types/athlete";

export interface WorkoutLogSummary {
  id: string;
  scheduledDate: string;
  originalScheduledDate: string;
  rescheduledByAthlete: boolean;
  coachAlert: boolean;
  status: string;
  athleteModifications: AthleteModifications | null;
}

/** Fetches the most recent non-skipped workout_log for a given session (by session_id). */
export function useWorkoutLog(athleteId: string, sessionId: string) {
  const mondayISO = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();

  return useQuery({
    queryKey: QK.workoutLogsWeek(athleteId, sessionId + "_detail"),
    enabled: !!athleteId && !!sessionId,
    staleTime: 30_000,
    queryFn: async (): Promise<WorkoutLogSummary | null> => {
      const { data } = await supabase
        .from("workout_logs")
        .select("id, scheduled_date, original_scheduled_date, rescheduled_by_athlete, coach_alert, status, athlete_modifications")
        .eq("athlete_id", athleteId)
        .eq("session_id", sessionId)
        .neq("status", "skipped")
        .order("scheduled_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return null;

      return {
        id:                    data.id,
        scheduledDate:         data.scheduled_date,
        originalScheduledDate: (data as { original_scheduled_date?: string }).original_scheduled_date ?? data.scheduled_date,
        rescheduledByAthlete:  (data as { rescheduled_by_athlete?: boolean }).rescheduled_by_athlete ?? false,
        coachAlert:            (data as { coach_alert?: boolean }).coach_alert ?? false,
        status:                data.status,
        athleteModifications:  (data as { athlete_modifications?: AthleteModifications }).athlete_modifications ?? null,
      };
    },
  });
}
