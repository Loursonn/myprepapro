import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BlockConfig, WellnessData } from "@/features/shared/types/athlete";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTHS_FR = ["jan","fév","mar","avr","mai","jui","jul","aoû","sep","oct","nov","déc"];

function weekBounds(blockStartDate: string, weekIndex: number) {
  const d = new Date(blockStartDate + "T12:00:00");
  // Align to Monday of blockStart week
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  // Advance to the target week (1-based)
  d.setDate(d.getDate() + (weekIndex - 1) * 7);
  const monday = new Date(d);
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + 6);
  return { monday, mondayISO: localISO(monday), sundayISO: localISO(sunday) };
}

function weekLabel(mondayISO: string, weekIndex: number) {
  const d = new Date(mondayISO + "T12:00:00");
  return `S${weekIndex} — ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkoutLogRow {
  id: string;
  status: string;
  rpe_score: number | null;
  notes: string | null;
  scheduled_date: string;
}

export interface WeekSideData {
  weekIndex: number;
  label: string;
  mondayISO: string;
  workoutLog: WorkoutLogRow | null;
  wellness: WellnessData | null;
  isLoading: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  sessId: string;
  athleteId: string;
  blockConfig: BlockConfig | null;
  currentWeekIndex: number; // 1-based
  cycleWeekCount: number;
  wellnessHistory: Record<string, WellnessData>;
  initialWeekIndex?: number; // override default right week
  completedSessions?: Record<number, string[]>; // for skip fallback
}

export function useWorkoutSplitData({
  sessId,
  athleteId,
  blockConfig,
  currentWeekIndex,
  cycleWeekCount,
  wellnessHistory,
  initialWeekIndex,
  completedSessions,
}: Props) {
  const [rightWeekIndex, setRightWeekIndex] = useState(initialWeekIndex ?? currentWeekIndex);
  const leftWeekIndex = rightWeekIndex - 1; // 0 = no left data (first week)

  // Last truly completed week before leftWeekIndex (used when left is skipped)
  const fallbackWeekIndex = useMemo<number | null>(() => {
    if (!completedSessions) return null;
    for (let w = leftWeekIndex - 1; w >= 1; w--) {
      if (completedSessions[w]?.includes(sessId)) return w;
    }
    return null;
  }, [completedSessions, sessId, leftWeekIndex]);

  const leftBounds = useMemo(() => {
    if (!blockConfig?.startDate || leftWeekIndex < 1) return null;
    return weekBounds(blockConfig.startDate, leftWeekIndex);
  }, [blockConfig?.startDate, leftWeekIndex]);

  const rightBounds = useMemo(() => {
    if (!blockConfig?.startDate) return null;
    return weekBounds(blockConfig.startDate, rightWeekIndex);
  }, [blockConfig?.startDate, rightWeekIndex]);

  const fallbackBounds = useMemo(() => {
    if (!fallbackWeekIndex || !blockConfig?.startDate) return null;
    return weekBounds(blockConfig.startDate, fallbackWeekIndex);
  }, [blockConfig?.startDate, fallbackWeekIndex]);

  // ── Fetch left workout_log ──────────────────────────────────────────────────
  const { data: leftLogs, isLoading: leftLogLoading } = useQuery({
    queryKey: ["wl-split", "left", athleteId, sessId, leftBounds?.mondayISO],
    enabled: !!athleteId && !!sessId && !!leftBounds,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_logs")
        .select("id, status, rpe_score, notes, scheduled_date")
        .eq("athlete_id", athleteId)
        .eq("session_id", sessId)
        .gte("scheduled_date", leftBounds!.mondayISO)
        .lte("scheduled_date", leftBounds!.sundayISO)
        .order("scheduled_date", { ascending: false })
        .limit(1);
      return (data ?? []) as WorkoutLogRow[];
    },
  });

  const leftLog = leftLogs?.[0] ?? null;

  // ── Fetch right workout_log (status only) ──────────────────────────────────
  const { data: rightLogs } = useQuery({
    queryKey: ["wl-split", "right", athleteId, sessId, rightBounds?.mondayISO],
    enabled: !!athleteId && !!sessId && !!rightBounds,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_logs")
        .select("id, status, rpe_score, notes, scheduled_date")
        .eq("athlete_id", athleteId)
        .eq("session_id", sessId)
        .gte("scheduled_date", rightBounds!.mondayISO)
        .lte("scheduled_date", rightBounds!.sundayISO)
        .order("scheduled_date", { ascending: false })
        .limit(1);
      return (data ?? []) as WorkoutLogRow[];
    },
  });

  const rightLog = rightLogs?.[0] ?? null;

  // ── Fallback left query (for when left week was skipped) ──────────────────
  const { data: fallbackLogs, isLoading: fallbackLogLoading } = useQuery({
    queryKey: ["wl-split", "fallback", athleteId, sessId, fallbackBounds?.mondayISO],
    enabled: !!athleteId && !!sessId && !!fallbackBounds,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_logs")
        .select("id, status, rpe_score, notes, scheduled_date")
        .eq("athlete_id", athleteId)
        .eq("session_id", sessId)
        .gte("scheduled_date", fallbackBounds!.mondayISO)
        .lte("scheduled_date", fallbackBounds!.sundayISO)
        .order("scheduled_date", { ascending: false })
        .limit(1);
      return (data ?? []) as WorkoutLogRow[];
    },
  });
  const fallbackLog = fallbackLogs?.[0] ?? null;

  // ── Wellness for left week (most recent day with data) ─────────────────────
  const leftWellness = useMemo<WellnessData | null>(() => {
    if (!leftBounds) return null;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(leftBounds.monday);
      d.setDate(d.getDate() + i);
      const entry = wellnessHistory[localISO(d)];
      if (entry) return entry;
    }
    return null;
  }, [leftBounds, wellnessHistory]);

  // ── Fallback wellness ──────────────────────────────────────────────────────
  const fallbackWellness = useMemo<WellnessData | null>(() => {
    if (!fallbackBounds) return null;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(fallbackBounds.monday);
      d.setDate(d.getDate() + i);
      const entry = wellnessHistory[localISO(d)];
      if (entry) return entry;
    }
    return null;
  }, [fallbackBounds, wellnessHistory]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isRightEditable = rightWeekIndex >= currentWeekIndex;

  const leftData: WeekSideData = {
    weekIndex: leftWeekIndex,
    label: leftBounds ? weekLabel(leftBounds.mondayISO, leftWeekIndex) : "",
    mondayISO: leftBounds?.mondayISO ?? "",
    workoutLog: leftLog,
    wellness: leftWellness,
    isLoading: leftLogLoading,
  };

  const rightData: WeekSideData & { isEditable: boolean } = {
    weekIndex: rightWeekIndex,
    label: rightBounds ? weekLabel(rightBounds.mondayISO, rightWeekIndex) : `S${rightWeekIndex}`,
    mondayISO: rightBounds?.mondayISO ?? "",
    workoutLog: rightLog,
    wellness: null,
    isLoading: false,
    isEditable: isRightEditable,
  };

  const fallbackLeftData: WeekSideData | null = fallbackBounds && fallbackWeekIndex ? {
    weekIndex: fallbackWeekIndex,
    label: weekLabel(fallbackBounds.mondayISO, fallbackWeekIndex),
    mondayISO: fallbackBounds.mondayISO,
    workoutLog: fallbackLog,
    wellness: fallbackWellness,
    isLoading: fallbackLogLoading,
  } : null;

  return {
    leftData,
    rightData,
    rightWeekIndex,
    fallbackLeftData,
    fallbackWeekIndex,
    navigateRight: (dir: "prev" | "next") =>
      setRightWeekIndex(p =>
        dir === "prev" ? Math.max(1, p - 1) : Math.min(cycleWeekCount, p + 1)
      ),
    canGoPrev: rightWeekIndex > 1,
    canGoNext: rightWeekIndex < cycleWeekCount,
    isRightEditable,
  };
}
