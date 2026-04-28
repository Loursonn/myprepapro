import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ActivityType = "session" | "wellness" | "pr";

export interface ActivityItem {
  id: string;
  athleteId: string;
  athleteName: string;
  type: ActivityType;
  label: string;
  updatedAt: Date;
}

const KEY_TYPES: Record<string, ActivityType> = {
  "asp:sessionlogs": "session",
  "asp:wh":          "wellness",
};

/**
 * Last `limit` activity events across all athletes.
 * Uses app_data.updated_at as the activity timestamp.
 * One row per athlete/key = "athlete X did something of this type".
 */
export function useRecentActivity(limit = 10) {
  const { athletes, user } = useAuth();
  const athleteIds = useMemo(() => athletes.map((a) => a.id), [athletes]);

  const query = useQuery({
    queryKey: ["coach_activity", user?.id, limit],
    queryFn: async () => {
      const { data, error } = await db
        .from("app_data")
        .select("athlete_id, key, updated_at")
        .in("athlete_id", athleteIds)
        .in("key", ["asp:sessionlogs", "asp:wh"])
        .order("updated_at", { ascending: false })
        .limit(limit * 3); // over-fetch to have headroom after dedup
      if (error) throw error;
      return (data ?? []) as {
        athlete_id: string;
        key: string;
        updated_at: string;
      }[];
    },
    enabled: athleteIds.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const activities = useMemo<ActivityItem[]>(() => {
    const rows = query.data ?? [];
    // Deduplicate per athlete+type (keep most recent)
    const seen = new Set<string>();

    return rows
      .flatMap((r) => {
        const key = `${r.athlete_id}:${r.key}`;
        if (seen.has(key)) return [];
        seen.add(key);
        const athlete = athletes.find((a) => a.id === r.athlete_id);
        if (!athlete) return [];
        const type = KEY_TYPES[r.key];
        if (!type) return [];
        const label =
          type === "session"
            ? `${athlete.full_name} a enregistré une séance`
            : `${athlete.full_name} a rempli son bilan wellness`;
        return [{
          id:          `${r.athlete_id}_${r.key}`,
          athleteId:   r.athlete_id,
          athleteName: athlete.full_name,
          type,
          label,
          updatedAt:   new Date(r.updated_at),
        }];
      })
      .slice(0, limit);
  }, [query.data, athletes, limit]);

  return { activities, isLoading: query.isLoading };
}
