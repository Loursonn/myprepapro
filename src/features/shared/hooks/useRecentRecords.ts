import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { QK } from "@/lib/queryKeys";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface RecentRecord {
  id:             string;
  athleteId:      string;
  athleteName:    string;
  metricName:     string;
  value:          number;
  unit:           string;
  date:           string;
  coachValidated: boolean | null;
}

/** Last `limit` performance_logs across all coached athletes, newest first. */
export function useRecentRecords(limit = 8) {
  const { athletes, user } = useAuth();
  const athleteIds = useMemo(() => athletes.map((a) => a.id), [athletes]);

  const query = useQuery({
    queryKey: QK.coachDashboard.recentRecords(user?.id ?? ""),
    queryFn: async () => {
      const { data, error } = await db
        .from("performance_logs")
        .select("id, athlete_id, metric_name, value, unit, date, coach_validated")
        .in("athlete_id", athleteIds)
        .order("date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as {
        id: string; athlete_id: string; metric_name: string;
        value: number; unit: string; date: string; coach_validated: boolean | null;
      }[];
    },
    enabled: !!user && athleteIds.length > 0,
    staleTime: 120_000,
    refetchOnWindowFocus: true,
  });

  const records = useMemo<RecentRecord[]>(() => {
    return (query.data ?? []).map((r) => {
      const athlete = athletes.find((a) => a.id === r.athlete_id);
      return {
        id:             r.id,
        athleteId:      r.athlete_id,
        athleteName:    athlete?.full_name ?? "—",
        metricName:     r.metric_name,
        value:          r.value,
        unit:           r.unit,
        date:           r.date,
        coachValidated: r.coach_validated,
      };
    });
  }, [query.data, athletes]);

  return { records, isLoading: query.isLoading };
}
