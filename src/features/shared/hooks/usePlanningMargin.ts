import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { QK } from "@/lib/queryKeys";
import { localISO } from "@/lib/date";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface CycleEndingSoon {
  cycleId:      string;
  athleteId:    string;
  athleteName:  string;
  cycleName:    string;
  endDate:      string;
  daysLeft:     number;
}

/** Cycles ending within `daysAhead` days — signals the coach to plan the next block. */
export function usePlanningMargin(daysAhead = 14) {
  const { athletes, user } = useAuth();
  const athleteIds = useMemo(() => athletes.map((a) => a.id), [athletes]);

  const today = useMemo(() => localISO(), []);
  const limit = useMemo(
    () => localISO(new Date(Date.now() + daysAhead * 86400000)),
    [daysAhead],
  );

  const query = useQuery({
    queryKey: QK.coachDashboard.planningMargin(user?.id ?? ""),
    queryFn: async () => {
      const { data, error } = await db
        .from("cycles")
        .select("id, athlete_id, name, start_date, end_date")
        .in("athlete_id", athleteIds)
        .lte("start_date", today)   // cycle must have started
        .gte("end_date", today)
        .lte("end_date", limit)
        .order("end_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as {
        id: string; athlete_id: string; name: string; start_date: string; end_date: string;
      }[];
    },
    enabled: !!user && athleteIds.length > 0,
    staleTime: 120_000,
    refetchOnWindowFocus: true,
  });

  const cycles = useMemo<CycleEndingSoon[]>(() => {
    const now = Date.now();
    return (query.data ?? []).map((c) => {
      const athlete = athletes.find((a) => a.id === c.athlete_id);
      const daysLeft = Math.ceil(
        (new Date(c.end_date).getTime() - now) / 86400000,
      );
      return {
        cycleId:     c.id,
        athleteId:   c.athlete_id,
        athleteName: athlete?.full_name ?? "—",
        cycleName:   c.name,
        endDate:     c.end_date,
        daysLeft:    Math.max(0, daysLeft),
      };
    });
  }, [query.data, athletes]);

  return { cycles, isLoading: query.isLoading };
}
