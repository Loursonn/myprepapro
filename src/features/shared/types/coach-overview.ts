/**
 * Types pour le retour de la RPC get_coach_overview(coach_uuid).
 * Correspond à la structure JSONB retournée par la fonction Postgres.
 */
import type { Json } from "@/integrations/supabase/types";
import type { WellnessData, BlockConfig, Session } from "./athlete";
import type { Competition } from "@/types/planning";

// ── Retour brut de la RPC ─────────────────────────────────────────────────────

export interface CoachOverviewRaw {
  athlete_count: number;
  competitions_count: number;
  wellness_today: Array<{ athlete_id: string; value: WellnessData | null }>;
  wellness_history: Array<{ athlete_id: string; value: Record<string, WellnessData> | null }>;
  sessions_data: Array<{ athlete_id: string; key: string; value: Json }>;
  competitions_upcoming: Competition[];
  recent_activity: Array<{ athlete_id: string; key: string; updated_at: string }>;
}

// ── Type dérivé pour useCoachOverview ────────────────────────────────────────

export interface CoachOverview {
  athleteCount: number;
  wellnessMean: number | null;
  wellnessColor: string;
  competitionsCount: number;
  sessionRatio: { completed: number; planned: number } | null;
  isLoading: boolean;
}

// ── Workout log status ───────────────────────────────────────────────────────

export type WorkoutStatus = "planned" | "in_progress" | "completed" | "missed" | "skipped";

export interface WorkoutLog {
  id: string;
  athlete_id: string;
  coach_id: string | null;
  session_id: string;
  session_name: string;
  scheduled_date: string;
  status: WorkoutStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_s: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Mappe une valeur app_data key → type connu */
export type AppDataKey =
  | "asp:wellness"
  | "asp:wh"
  | "asp:blockConfig"
  | "asp:sessions"
  | "asp:completed"
  | "asp:sessionlogs"
  | "asp:prs"
  | "asp:coach_feedback"
  | "app:user_feedback";

// Type-safe extraction helper
export function asBlockConfig(v: Json): BlockConfig {
  return (v ?? {}) as BlockConfig;
}

export function asSessions(v: Json): Session[] {
  return (Array.isArray(v) ? v : []) as Session[];
}

export function asCompletedMap(v: Json): Record<number, string[]> {
  return (v ?? {}) as Record<number, string[]>;
}

export function asWellnessData(v: Json): WellnessData | null {
  return (v as WellnessData | null) ?? null;
}
