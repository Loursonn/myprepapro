import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEF_BLOCK_CONFIG } from "@/lib/exercises";
import type { BlockConfig, Session } from "../types/athlete";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface MissedWorkout {
  athleteId: string;
  athleteName: string;
  sessionName: string;
  sessionId: string;
}

function computeCurrentWeek(bc: BlockConfig): number {
  const tw = bc.totalWeeks || 6;
  if (bc.startDate) {
    const days = Math.floor((Date.now() - new Date(bc.startDate).getTime()) / 86400000);
    return Math.min(Math.max(1, Math.floor(days / 7) + 1), tw);
  }
  return 1;
}

/**
 * day_of_week convention: 0=Mon … 6=Sun (matches DashboardPage: (getDay()+6)%7).
 * "Yesterday" = the day whose day_of_week matches yesterday's weekday.
 */
function yesterdayDow(): number {
  return (new Date(Date.now() - 86400000).getDay() + 6) % 7;
}

/**
 * Sessions that were assigned to yesterday (by day_of_week) but are not yet
 * present in the athlete's completedSessions for the current block week.
 */
export function useMissedWorkouts() {
  const { athletes, user } = useAuth();
  const athleteIds = useMemo(() => athletes.map((a) => a.id), [athletes]);

  const query = useQuery({
    queryKey: ["coach_missed", user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("app_data")
        .select("athlete_id, key, value")
        .in("athlete_id", athleteIds)
        .in("key", ["asp:completed", "asp:blockConfig", "asp:sessions"]);
      if (error) throw error;
      return (data ?? []) as { athlete_id: string; key: string; value: unknown }[];
    },
    enabled: athleteIds.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const missed = useMemo<MissedWorkout[]>(() => {
    const rows = query.data ?? [];
    if (!rows.length) return [];

    const dow = yesterdayDow();

    // Group rows by athlete
    const byAthlete: Record<string, Record<string, unknown>> = {};
    rows.forEach((r) => {
      byAthlete[r.athlete_id] ??= {};
      byAthlete[r.athlete_id][r.key] = r.value;
    });

    const result: MissedWorkout[] = [];

    Object.entries(byAthlete).forEach(([athleteId, data]) => {
      const athlete = athletes.find((a) => a.id === athleteId);
      if (!athlete) return;

      const bc      = (data["asp:blockConfig"] ?? DEF_BLOCK_CONFIG) as BlockConfig;
      const sessions = (data["asp:sessions"]   ?? []) as Session[];
      const done     = (data["asp:completed"]  ?? {}) as Record<number, string[]>;
      const week     = computeCurrentWeek(bc);
      const doneIds  = new Set(done[week] ?? []);

      sessions.forEach((s) => {
        if (s.day_of_week === dow && !doneIds.has(s.id)) {
          result.push({
            athleteId:   athlete.id,
            athleteName: athlete.full_name,
            sessionName: s.name,
            sessionId:   s.id,
          });
        }
      });
    });

    return result;
  }, [query.data, athletes]);

  return { missed, isLoading: query.isLoading };
}
