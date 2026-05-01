/**
 * useUnifiedCalendar — single source of truth for all calendar data.
 *
 * Replaces useCalendarEvents (month-scoped) and the inner queries of
 * useWeekSchedule (week-scoped). All mutations invalidate the same
 * partial key ["cal", athleteId] so every active range refetches automatically.
 *
 * Views manage their own date-range; the hook is just a typed Supabase fetch.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Exercise, WeekConfig } from "@/features/shared/types/athlete";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UCEventType = "workout" | "test" | "competition";

export interface UnifiedCalendarEvent {
  id: string;
  type: UCEventType;
  date: string;           // ISO yyyy-MM-dd
  title: string;
  status?: string;        // planned | completed | missed | skipped
  rpe?: number | null;
  // Workout-specific
  sessionId?: string;     // workout_logs.session_id
  exercises?: Exercise[]; // populated only when includeExercises = true
  // Test-specific
  testType?: string;
  completed?: boolean;
  // Competition-specific
  priority?: string;
  location?: string;
  /** Raw DB row for fields not promoted to typed fields */
  raw: Record<string, unknown>;
}

// ── Query key helpers ─────────────────────────────────────────────────────────

/** Partial key — used by mutations to invalidate ALL ranges for an athlete. */
export const calBaseKey = (athleteId: string) => ["cal", athleteId] as const;

/** Full key for a specific range query. */
export const calRangeKey = (athleteId: string, start: string, end: string) =>
  ["cal", athleteId, start, end] as const;

// ── Main hook ─────────────────────────────────────────────────────────────────

export interface UseUnifiedCalendarOptions {
  /** Also fetch session_exercises → exercises for workout events. Default: false. */
  includeExercises?: boolean;
  staleTime?: number;
}

export function useUnifiedCalendar(
  athleteId: string,
  range: { start: string; end: string },
  options: UseUnifiedCalendarOptions = {},
) {
  const { includeExercises = false, staleTime = 30_000 } = options;
  const { start, end } = range;

  return useQuery({
    queryKey: calRangeKey(athleteId, start, end),
    enabled: !!athleteId && !!start && !!end,
    staleTime,
    queryFn: async (): Promise<UnifiedCalendarEvent[]> => {
      // ── 1. Parallel fetch: workouts + tests + competitions ─────────────────
      const [wRes, tRes, cRes] = await Promise.all([
        supabase
          .from("workout_logs")
          .select("id, session_id, session_name, scheduled_date, status, rpe_score")
          .eq("athlete_id", athleteId)
          .gte("scheduled_date", start)
          .lte("scheduled_date", end)
          .order("scheduled_date"),

        supabase
          .from("test_sessions")
          .select("id, title, date, completed, type")
          .eq("athlete_id", athleteId)
          .gte("date", start)
          .lte("date", end)
          .order("date"),

        supabase
          .from("competitions")
          .select("id, name, date, priority, location, notes")
          .eq("athlete_id", athleteId)
          .gte("date", start)
          .lte("date", end)
          .order("date"),
      ]);

      const logs  = wRes.data ?? [];
      const tests = tRes.data ?? [];
      const comps = cRes.data ?? [];

      // ── 2. Optionally fetch exercises ──────────────────────────────────────
      const exercisesBySession: Record<string, Exercise[]> = {};

      if (includeExercises && logs.length > 0) {
        const sessionIds = [
          ...new Set(logs.map((l) => l.session_id).filter((id): id is string => !!id)),
        ];
        if (sessionIds.length > 0) {
          const { data: seData } = await supabase
            .from("session_exercises")
            .select("session_id, exercise_id, order, weeks_config, exercises(id, name, bloc, target, ex_type)")
            .in("session_id", sessionIds)
            .order("order");

          for (const se of seData ?? []) {
            const ex = se.exercises as {
              id: string; name: string; bloc?: string; target?: string; ex_type?: string;
            } | null;
            if (!ex) continue;
            const mapped: Exercise = {
              id: se.exercise_id,
              name: ex.name,
              bloc: ex.bloc ?? undefined,
              target: ex.target ?? undefined,
              exType: ex.ex_type ?? undefined,
              weeks: (se.weeks_config as Record<number, WeekConfig>) ?? {},
            };
            (exercisesBySession[se.session_id] ??= []).push(mapped);
          }
        }
      }

      // ── 3. Build typed events ──────────────────────────────────────────────
      const events: UnifiedCalendarEvent[] = [];

      for (const w of logs) {
        const rpe = (w as Record<string, unknown>).rpe_score as number | null ?? null;
        events.push({
          id:        w.id,
          type:      "workout",
          date:      w.scheduled_date,
          title:     w.session_name,
          status:    w.status,
          rpe,
          sessionId: w.session_id ?? undefined,
          exercises: includeExercises ? (exercisesBySession[w.session_id ?? ""] ?? []) : undefined,
          raw:       { ...(w as Record<string, unknown>), session_id: w.session_id },
        });
      }

      for (const t of tests) {
        events.push({
          id:        t.id,
          type:      "test",
          date:      t.date,
          title:     t.title,
          status:    t.completed ? "completed" : "planned",
          completed: t.completed,
          testType:  t.type,
          raw:       t as Record<string, unknown>,
        });
      }

      for (const c of comps) {
        events.push({
          id:       c.id,
          type:     "competition",
          date:     c.date,
          title:    c.name,
          priority: c.priority ?? undefined,
          location: c.location ?? undefined,
          raw:      c as Record<string, unknown>,
        });
      }

      return events;
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useAssignWorkout() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      sessionName,
      athleteId,
      coachId,
      date,
    }: {
      sessionId: string;
      sessionName: string;
      athleteId: string;
      coachId: string;
      date: string;
    }) => {
      const { error } = await supabase.from("workout_logs").insert({
        athlete_id:     athleteId,
        coach_id:       coachId,
        session_id:     sessionId,
        session_name:   sessionName,
        scheduled_date: date,
        status:         "planned",
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: calBaseKey(vars.athleteId) });
      // Bridge: also invalidate old key until all consumers migrated
      qc.invalidateQueries({ queryKey: ["calendar-events", vars.athleteId] });
      qc.invalidateQueries({ queryKey: ["week-schedule", vars.athleteId] });
      toast.success("Séance ajoutée");
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });
}

export function useCreateTestSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      athleteId,
      coachId,
      title,
      type,
      date,
    }: {
      athleteId: string;
      coachId: string;
      title: string;
      type: string;
      date: string;
    }) => {
      const { error } = await supabase.from("test_sessions").insert({
        athlete_id: athleteId,
        coach_id:   coachId,
        title,
        type,
        date,
        completed:  false,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: calBaseKey(vars.athleteId) });
      qc.invalidateQueries({ queryKey: ["calendar-events", vars.athleteId] });
      qc.invalidateQueries({ queryKey: ["week-schedule", vars.athleteId] });
      toast.success("Test créé");
    },
    onError: () => toast.error("Erreur lors de la création"),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      type,
      athleteId,
      coachId,
      sessionId,
      sessionName,
      date,
    }: {
      id: string;
      type: UCEventType;
      athleteId: string;
      coachId?: string;
      sessionId?: string;
      sessionName?: string;
      date?: string;
    }) => {
      if (type === "competition") return;

      // Projected block-plan event: suppress by inserting a skipped workout_log
      if (type === "workout" && id.startsWith("block-") && sessionId && date) {
        const { error } = await supabase.from("workout_logs").insert({
          athlete_id:     athleteId,
          coach_id:       coachId ?? null,
          session_id:     sessionId,
          session_name:   sessionName ?? "Séance",
          scheduled_date: date,
          status:         "skipped",
        });
        if (error) throw error;
        return;
      }

      const table = type === "workout" ? "workout_logs" : "test_sessions";
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: calBaseKey(vars.athleteId) });
      qc.invalidateQueries({ queryKey: ["calendar-events", vars.athleteId] });
      qc.invalidateQueries({ queryKey: ["week-schedule", vars.athleteId] });
      qc.invalidateQueries({ queryKey: ["workout-logs-week", vars.athleteId] });
      toast.success("Supprimé");
    },
  });
}

// ── Compat adapter: map UnifiedCalendarEvent → CalEvent ──────────────────────
// Allows gradual migration of components still typed against CalEvent.

export interface CalEvent {
  id: string;
  title: string;
  date: string;
  type: UCEventType;
  status?: string;
  rpe?: number | null;
  raw: Record<string, unknown>;
}

export function toCalEvent(e: UnifiedCalendarEvent): CalEvent {
  return {
    id:     e.id,
    title:  e.title,
    date:   e.date,
    type:   e.type,
    status: e.status,
    rpe:    e.rpe,
    raw:    e.raw,
  };
}
