import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Competition } from "@/types/planning";
import { localISO } from "@/lib/date";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface UpcomingCompetition extends Competition {
  athleteName: string;
  daysUntil: number;
}

/**
 * Competitions for all coached athletes within the next `daysAhead` days.
 * Sorted by date ascending.
 */
export function useUpcomingCompetitions(daysAhead = 30) {
  const { athletes, user } = useAuth();
  const athleteIds = useMemo(() => athletes.map((a) => a.id), [athletes]);

  const today = useMemo(() => localISO(), []);
  const limit = useMemo(
    () => localISO(new Date(Date.now() + daysAhead * 86400000)),
    [daysAhead],
  );

  const query = useQuery({
    queryKey: ["coach_competitions", user?.id, daysAhead],
    queryFn: async () => {
      const { data, error } = await db
        .from("competitions")
        .select("*")
        .in("athlete_id", athleteIds)
        .gte("date", today)
        .lte("date", limit)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Competition[];
    },
    enabled: athleteIds.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const competitions = useMemo<UpcomingCompetition[]>(() => {
    const now = Date.now();
    return (query.data ?? []).map((c) => {
      const athlete = athletes.find((a) => a.id === c.athlete_id);
      const daysUntil = Math.ceil(
        (new Date(c.date).getTime() - now) / 86400000,
      );
      return {
        ...c,
        athleteName: athlete?.full_name ?? "—",
        daysUntil: Math.max(0, daysUntil),
      };
    });
  }, [query.data, athletes]);

  return { competitions, isLoading: query.isLoading };
}
