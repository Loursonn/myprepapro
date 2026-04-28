import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { WellnessData } from "../types/athlete";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface OverloadedAthlete {
  id: string;
  full_name: string;
  /** Max fatigue over last 3 days */
  fatigue: number;
  /** Min sleep quality over last 3 days */
  sleep: number;
  /** Number of consecutive days with issues (always ≥3) */
  streak: number;
}

/** Returns ISO date strings for the last N days (most recent first). */
function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (i + 1) * 86400000);
    return d.toISOString().split("T")[0];
  });
}

/**
 * Athletes with fatigue > 7 OR sleep < 5 for at least 3 consecutive days.
 * Reads wellness history (asp:wh) in a single batch query.
 */
export function useOverloadedAthletes() {
  const { athletes, user } = useAuth();
  const athleteIds = useMemo(() => athletes.map((a) => a.id), [athletes]);

  const query = useQuery({
    queryKey: ["coach_overloaded", user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("app_data")
        .select("athlete_id, value")
        .in("athlete_id", athleteIds)
        .eq("key", "asp:wh");
      if (error) throw error;
      return (data ?? []) as {
        athlete_id: string;
        value: Record<string, WellnessData>;
      }[];
    },
    enabled: athleteIds.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const overloaded = useMemo<OverloadedAthlete[]>(() => {
    const last3 = lastNDays(3);
    return (query.data ?? [])
      .flatMap(({ athlete_id, value: history }) => {
        const athlete = athletes.find((a) => a.id === athlete_id);
        if (!athlete || !history) return [];

        let streak = 0;
        let maxFatigue = 0;
        let minSleep = 10;

        for (const day of last3) {
          const w = history[day];
          if (!w) break; // gap → not consecutive
          const badFatigue = typeof w.fatigue === "number" && w.fatigue > 7;
          const badSleep   = typeof w.sommeil === "number" && w.sommeil < 5;
          if (badFatigue || badSleep) {
            streak++;
            if (typeof w.fatigue === "number") maxFatigue = Math.max(maxFatigue, w.fatigue);
            if (typeof w.sommeil === "number") minSleep   = Math.min(minSleep,   w.sommeil);
          } else {
            break;
          }
        }

        if (streak < 3) return [];
        return [{
          id:        athlete.id,
          full_name: athlete.full_name,
          fatigue:   maxFatigue,
          sleep:     minSleep === 10 ? 5 : minSleep,
          streak,
        }];
      });
  }, [query.data, athletes]);

  return { overloaded, isLoading: query.isLoading };
}
