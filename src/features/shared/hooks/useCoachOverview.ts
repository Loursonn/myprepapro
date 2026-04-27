import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEF_BLOCK_CONFIG } from "@/lib/exercises";
import type { WellnessData, BlockConfig, Session } from "../types/athlete";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const COMMON = { staleTime: 60_000, refetchOnWindowFocus: true } as const;

/** Computes current block week (1-based) from blockConfig.startDate. */
function computeCurrentWeek(bc: BlockConfig): number {
  const tw = bc.totalWeeks || 6;
  if (bc.startDate) {
    const days = Math.floor((Date.now() - new Date(bc.startDate).getTime()) / 86400000);
    return Math.min(Math.max(1, Math.floor(days / 7) + 1), tw);
  }
  return 1;
}

export interface CoachOverview {
  athleteCount: number;
  wellnessMean: number | null;
  wellnessColor: string;
  competitionsCount: number;
  sessionRatio: { completed: number; planned: number } | null;
  isLoading: boolean;
}

/**
 * Aggregated KPI data for the coach home dashboard.
 * Uses batch queries — one Supabase call per data type across all athletes.
 */
export function useCoachOverview(): CoachOverview {
  const { athletes, user } = useAuth();
  const athleteIds = useMemo(() => athletes.map((a) => a.id), [athletes]);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const in30 = useMemo(
    () => new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    [],
  );

  // ── Today's wellness for all athletes ────────────────────────────────────────
  const wellnessQ = useQuery({
    queryKey: ["coach_kpi", "wellness", user?.id, today],
    queryFn: async () => {
      const { data, error } = await db
        .from("app_data")
        .select("athlete_id, value")
        .in("athlete_id", athleteIds)
        .eq("key", "asp:wellness");
      if (error) throw error;
      return (data ?? []) as { athlete_id: string; value: WellnessData | null }[];
    },
    enabled: athleteIds.length > 0,
    ...COMMON,
  });

  // ── Session completion data for all athletes ──────────────────────────────────
  const sessionsQ = useQuery({
    queryKey: ["coach_kpi", "sessions", user?.id],
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
    ...COMMON,
  });

  // ── Competitions in the next 30 days ─────────────────────────────────────────
  const competQ = useQuery({
    queryKey: ["coach_kpi", "competitions", user?.id, today],
    queryFn: async () => {
      const { data, error } = await db
        .from("competitions")
        .select("id")
        .in("athlete_id", athleteIds)
        .gte("date", today)
        .lte("date", in30);
      if (error) throw error;
      return (data ?? []) as { id: string }[];
    },
    enabled: athleteIds.length > 0,
    ...COMMON,
  });

  // ── Derived: wellness mean ────────────────────────────────────────────────────
  const { wellnessMean, wellnessColor } = useMemo(() => {
    const scores = (wellnessQ.data ?? [])
      .map((r) => (r.value as WellnessData | null)?.score)
      .filter((s): s is number => typeof s === "number");
    if (!scores.length) return { wellnessMean: null, wellnessColor: "#9194A0" };
    const mean = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const color = mean >= 70 ? "#22C993" : mean >= 50 ? "#F5A623" : "#EF4B4B";
    return { wellnessMean: mean, wellnessColor: color };
  }, [wellnessQ.data]);

  // ── Derived: session ratio this week ─────────────────────────────────────────
  const sessionRatio = useMemo(() => {
    const rows = sessionsQ.data ?? [];
    if (!rows.length) return null;

    const byAthlete: Record<string, Record<string, unknown>> = {};
    rows.forEach((r) => {
      byAthlete[r.athlete_id] ??= {};
      byAthlete[r.athlete_id][r.key] = r.value;
    });

    let totalCompleted = 0;
    let totalPlanned = 0;

    Object.values(byAthlete).forEach((data) => {
      const bc = (data["asp:blockConfig"] ?? DEF_BLOCK_CONFIG) as BlockConfig;
      const sess = (data["asp:sessions"] ?? []) as Session[];
      const done = (data["asp:completed"] ?? {}) as Record<number, string[]>;
      const week = computeCurrentWeek(bc);
      totalCompleted += (done[week] ?? []).length;
      totalPlanned += sess.length || 1;
    });

    return { completed: totalCompleted, planned: totalPlanned };
  }, [sessionsQ.data]);

  return {
    athleteCount: athletes.length,
    wellnessMean,
    wellnessColor,
    competitionsCount: competQ.data?.length ?? 0,
    sessionRatio,
    isLoading: wellnessQ.isLoading || sessionsQ.isLoading || competQ.isLoading,
  };
}
