import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type { AthleteModifications } from "@/features/shared/types/athlete";

export interface AthleteModificationLog {
  id: string;
  sessionName: string;
  scheduledDate: string;
  originalScheduledDate: string;
  rescheduledByAthlete: boolean;
  rescheduleReason: string | null;
  coachAlert: boolean;
  athleteModifications: AthleteModifications | null;
  status: string;
}

/**
 * Fetches workout_logs with athlete modifications (reschedule or bonus sets/exercises).
 * Used by coach RetoursPage.
 */
export function useAthleteModifications(athleteId: string) {
  return useQuery({
    queryKey: QK.athleteModifications(athleteId),
    enabled: !!athleteId,
    staleTime: 30_000,
    queryFn: async (): Promise<AthleteModificationLog[]> => {
      // NOTE: requires migration 20260507000000_athlete_flexibility — returns [] until applied
      const { data } = await supabase
        .from("workout_logs")
        .select("id, session_name, scheduled_date, original_scheduled_date, rescheduled_by_athlete, reschedule_reason, coach_alert, athlete_modifications, status")
        .eq("athlete_id", athleteId)
        .or("rescheduled_by_athlete.eq.true,athlete_modifications.not.is.null")
        .order("scheduled_date", { ascending: false })
        .limit(50);

      return (data ?? []).map((row) => ({
        id:                    row.id,
        sessionName:           row.session_name,
        scheduledDate:         row.scheduled_date,
        originalScheduledDate: (row as { original_scheduled_date?: string }).original_scheduled_date ?? row.scheduled_date,
        rescheduledByAthlete:  (row as { rescheduled_by_athlete?: boolean }).rescheduled_by_athlete ?? false,
        rescheduleReason:      (row as { reschedule_reason?: string | null }).reschedule_reason ?? null,
        coachAlert:            (row as { coach_alert?: boolean }).coach_alert ?? false,
        athleteModifications:  (row as { athlete_modifications?: AthleteModifications }).athlete_modifications ?? null,
        status:                row.status,
      }));
    },
  });
}
