import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Competition } from "@/types/planning";
import { localISO } from "@/lib/date";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface UpcomingAthleteCompetition extends Competition {
  daysUntil: number;
}

/**
 * Next upcoming competition for a specific athlete.
 * Sorted by date ascending; returns the closest one.
 */
export function useUpcomingCompetition(athleteId: string) {
  return useQuery({
    queryKey: ["athlete_next_competition", athleteId],
    queryFn: async () => {
      const today = localISO();
      const { data, error } = await db
        .from("competitions")
        .select("*")
        .eq("athlete_id", athleteId)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const comp = data as Competition;
      const daysUntil = Math.max(
        0,
        Math.ceil((new Date(comp.date).getTime() - Date.now()) / 86400000),
      );
      return { ...comp, daysUntil } as UpcomingAthleteCompetition;
    },
    enabled: !!athleteId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
