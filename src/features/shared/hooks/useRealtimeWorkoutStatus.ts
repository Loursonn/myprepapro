import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";

/**
 * Subscribes to realtime changes on workout_logs for a given athlete.
 * When a row changes (status update, completion), invalidates the relevant
 * React Query caches so the UI stays in sync across multiple tabs/devices.
 *
 * The subscription is cleaned up when the component unmounts.
 */
export function useRealtimeWorkoutStatus(athleteId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!athleteId) return;

    const channel = supabase
      .channel(`workout_logs:${athleteId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT | UPDATE | DELETE
          schema: "public",
          table: "workout_logs",
          filter: `athlete_id=eq.${athleteId}`,
        },
        (_payload) => {
          // Invalidate all queries that depend on workout status for this athlete.
          // This covers: useTodayWorkout, useWeekProgram, useWorkoutDetail, useCoachOverview.
          qc.invalidateQueries({ queryKey: QK.athleteData(athleteId) });
          qc.invalidateQueries({ queryKey: ["coach_kpi"] });
          qc.invalidateQueries({ queryKey: ["coach_overview_rpc"] });
          qc.invalidateQueries({ queryKey: ["coach_missed"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [athleteId, qc]);
}
