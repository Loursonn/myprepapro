import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type {
  WeeklyRetourData, WeekComparisonData,
  PerformedExercise, PerformedSet, PlannedExercise, WellnessDay, EnergySessionDetail,
} from "@/features/shared/types/retours.types";
import type { SetRow, Exercise, BlockConfig, ArchivedBlock } from "@/features/shared/types/athlete";
import { startOfWeek, endOfWeek, subWeeks, format, eachDayOfInterval, addDays } from "date-fns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useWeeklyRetours(athleteId: string, weekStartDate: Date) {
  return useQuery({
    queryKey: QK.weeklyRetours(athleteId, format(weekStartDate, "yyyy-MM-dd")),
    queryFn: async (): Promise<WeekComparisonData> => {
      const curStart  = startOfWeek(weekStartDate, { weekStartsOn: 1 });
      const curEnd    = endOfWeek(weekStartDate,   { weekStartsOn: 1 });
      const prevStart = startOfWeek(subWeeks(weekStartDate, 1), { weekStartsOn: 1 });
      const prevEnd   = endOfWeek(subWeeks(weekStartDate, 1),   { weekStartsOn: 1 });

      // Load app_data once (shared between current + previous week)
      const { data: appDataRows } = await db
        .from("app_data")
        .select("key, value")
        .eq("athlete_id", athleteId)
        .in("key", ["asp:wh", "asp:sets", "asp:exos", "asp:blockConfig", "asp:sessionlogs", "asp:blockHistory"]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appDataMap: Record<string, any> = Object.fromEntries(
        (appDataRows ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])
      );

      const [currentWeek, previousWeek] = await Promise.all([
        fetchWeekData(athleteId, curStart, curEnd, appDataMap),
        fetchWeekData(athleteId, prevStart, prevEnd, appDataMap),
      ]);

      return { current_week: currentWeek, previous_week: previousWeek };
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!athleteId,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * todayKey() stores as "YYYYMMDD"; date-fns formats as "yyyy-MM-dd".
 * Normalize any 8-digit compact key to ISO dash format.
 */
function normalizeWHKey(key: string): string {
  if (/^\d{8}$/.test(key)) return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
  return key;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeWH(wh: Record<string, any>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(wh ?? {})) out[normalizeWHKey(k)] = v;
  return out;
}

/** Week number relative to a block's start (1-based). Fallback = 1. */
function calcWeekNum(dateStr: string, blockStartDate: string | null | undefined): number {
  if (!blockStartDate) return 1;
  const d = new Date(dateStr + "T12:00:00").getTime();
  const s = new Date(blockStartDate + "T12:00:00").getTime();
  const n = Math.floor((d - s) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return n >= 1 ? n : 1;
}

/**
 * Merge wellness histories from all archived blocks + current `asp:wh`.
 * Current block takes precedence for any date collision.
 */
function buildMergedWellness(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentWH: Record<string, any>,
  blockHistory: ArchivedBlock[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged: Record<string, any> = {};
  for (const block of blockHistory) {
    if (block.wellnessHistory) Object.assign(merged, normalizeWH(block.wellnessHistory));
  }
  Object.assign(merged, normalizeWH(currentWH)); // current block wins
  return merged;
}

/**
 * Given a workout date, find which block it belongs to and return its
 * exos, sets, and blockConfig. Falls back to current block data.
 */
function findBlockForDate(
  dateStr: string,
  currentBlockConfig: BlockConfig,
  currentExos: Record<string, Exercise[]>,
  currentSets: Record<string, SetRow[]>,
  blockHistory: ArchivedBlock[],
): { exos: Record<string, Exercise[]>; sets: Record<string, SetRow[]>; blockConfig: BlockConfig } {
  // Current block: starts at startDate and has no upper bound from our perspective
  if (currentBlockConfig.startDate && dateStr >= currentBlockConfig.startDate) {
    return { exos: currentExos, sets: currentSets, blockConfig: currentBlockConfig };
  }
  // Search archived blocks most-recent first
  for (const block of [...blockHistory].reverse()) {
    const bc = block.blockConfig;
    if (!bc?.startDate) continue;
    const endDate = format(
      addDays(new Date(bc.startDate + "T12:00:00"), bc.totalWeeks * 7),
      "yyyy-MM-dd",
    );
    if (dateStr >= bc.startDate && dateStr <= endDate) {
      return { exos: block.exos ?? {}, sets: block.sets ?? {}, blockConfig: bc };
    }
  }
  // Fallback: current block
  return { exos: currentExos, sets: currentSets, blockConfig: currentBlockConfig };
}

function buildDailyWellness(
  startDate: Date,
  endDate: Date,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mergedWH: Record<string, any>,
): Record<string, WellnessDay | null> {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const result: Record<string, WellnessDay | null> = {};
  for (const day of days) {
    const d = format(day, "yyyy-MM-dd");
    const e = mergedWH[d];
    result[d] = e
      ? {
          score:     e.score     ?? 0,
          fatigue:   e.fatigue   ?? 0,
          sommeil:   e.sommeil   ?? 0,
          stress:    e.stress    ?? 0,
          energie:   e.energie   ?? 0,
          doms:      e.doms,
          domsZones: e.domsZones,
          coucher:   e.coucher,
          reveil:    e.reveil,
          sleepDur:  e.sleepDur,
        }
      : null;
  }
  return result;
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function fetchWeekData(
  athleteId: string,
  startDate: Date,
  endDate: Date,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appDataMap: Record<string, any>,
): Promise<WeeklyRetourData> {
  const start = format(startDate, "yyyy-MM-dd");
  const end   = format(endDate,   "yyyy-MM-dd");

  // Current block data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentWH: Record<string, any>              = appDataMap["asp:wh"]           ?? {};
  const currentExos: Record<string, Exercise[]>     = appDataMap["asp:exos"]          ?? {};
  const currentSets: Record<string, SetRow[]>       = appDataMap["asp:sets"]           ?? {};
  const currentBlockConfig: BlockConfig             = appDataMap["asp:blockConfig"]   ?? {};
  const blockHistory: ArchivedBlock[]               = appDataMap["asp:blockHistory"]  ?? [];

  // Merged wellness across all blocks
  const mergedWH = buildMergedWellness(currentWH, blockHistory);

  // ── Parallel DB queries ──────────────────────────────────────────────────────
  const [workoutsRes, energyRes, testsRes, compsRes] = await Promise.all([
    db.from("workout_logs")
      .select("id, session_id, session_name, scheduled_date, status, duration_s, notes, rpe_score")
      .eq("athlete_id", athleteId)
      .neq("status", "skipped")
      .gte("scheduled_date", start)
      .lte("scheduled_date", end)
      .order("scheduled_date"),

    db.from("energy_session_assignments")
      .select("id, scheduled_date, status, notes, rpe_score, block_logs, energy_sessions(id, name, session_kind, total_duration_s, total_distance_m)")
      .eq("athlete_id", athleteId)
      .gte("scheduled_date", start)
      .lte("scheduled_date", end),

    db.from("test_sessions")
      .select("id, title, type, date, completed, results_note, coach_validated")
      .eq("athlete_id", athleteId)
      .gte("date", start)
      .lte("date", end),

    db.from("competitions")
      .select("id, name, type, date, location, athlete_comment, priority")
      .eq("athlete_id", athleteId)
      .gte("date", start)
      .lte("date", end),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workoutList: any[] = workoutsRes.data ?? [];
  const workoutIds = workoutList.map((w) => w.id as string);

  // Exercise comments
  const { data: comments = [] } = workoutIds.length > 0
    ? await db
        .from("workout_exercise_comments")
        .select("id, workout_log_id, exercise_id, exercise_name, comment, created_at, updated_at")
        .in("workout_log_id", workoutIds)
    : { data: [] as unknown[] };

  // Wellness averages (using merged history)
  const scoresInWeek = Object.entries(mergedWH)
    .filter(([d]) => d >= start && d <= end)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map(([, v]) => (v as any).score)
    .filter((s): s is number => s != null);
  const avgWellness = scoresInWeek.length > 0
    ? Math.round(scoresInWeek.reduce((a, b) => a + b, 0) / scoresInWeek.length)
    : null;

  // ── Build enriched workouts ──────────────────────────────────────────────────
  const enrichedWorkouts = workoutList.map((w) => {
    // Find which block this workout belongs to
    const { exos, sets, blockConfig } = findBlockForDate(
      w.scheduled_date, currentBlockConfig, currentExos, currentSets, blockHistory,
    );

    const weekNum  = calcWeekNum(w.scheduled_date, blockConfig.startDate);
    const exercises: Exercise[] = exos[w.session_id] ?? [];

    const planned: PlannedExercise[] = exercises.map((ex) => {
      const cfg = ex.weeks[weekNum] ?? {};
      return {
        exercise_id:   ex.id,
        exercise_name: ex.name,
        sets:          cfg.sets      ?? 0,
        reps_range:    cfg.repsRange ?? null,
        kg:            cfg.kg        ?? null,
        rir:           cfg.rir       ?? null,
        method:        cfg.method    ?? null,
      };
    });

    const performed: PerformedExercise[] = exercises
      .map((ex): PerformedExercise | null => {
        const rows = (sets[`${ex.id}_${weekNum}`] ?? [])
          .filter((r) => r.done)
          .map((r, i): PerformedSet => ({
            set_num: i + 1,
            kg:     r.kg   ?? null,
            reps:   r.reps ?? null,
            rir:    r.rir  ?? null,
            method: r.type ?? null,
          }));
        return rows.length > 0
          ? { exercise_id: ex.id, exercise_name: ex.name, sets: rows }
          : null;
      })
      .filter((e): e is PerformedExercise => e !== null);

    return {
      id:             w.id,
      session_name:   w.session_name,
      scheduled_date: w.scheduled_date,
      status:         w.status,
      duration_s:     w.duration_s ?? null,
      notes:          w.notes      ?? null,
      rpe_score:      w.rpe_score  ?? null,
      wellness_day:   mergedWH[w.scheduled_date]?.score ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exercise_comments: (comments as any[]).filter((c) => c.workout_log_id === w.id),
      planned_exercises:   planned,
      performed_exercises: performed,
    };
  });

  // ── Energy sessions ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const energySessions: EnergySessionDetail[] = (energyRes.data ?? []).map((e: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const es = (e.energy_sessions as any) ?? {};
    const blockLogs = (e.block_logs ?? {}) as Record<string, { done: boolean }>;
    const blVals = Object.values(blockLogs);
    const partial = blVals.length > 0 && blVals.some(b => b.done) && blVals.some(b => !b.done);
    return {
      id:            e.id,
      session_label: es.name             ?? "Session énergétique",
      date:          e.scheduled_date,
      completed:     e.status === "completed",
      partial,
      duration_min:  es.total_duration_s != null ? Math.round(es.total_duration_s / 60) : null,
      distance_m:    es.total_distance_m ?? null,
      session_kind:  es.session_kind     ?? null,
      note:          e.notes             ?? null,
      rpe_score:     e.rpe_score         ?? null,
      block_logs:    e.block_logs        ?? null,
    };
  });

  return {
    week_number:    calcWeekNum(start, currentBlockConfig.startDate),
    start_date:     start,
    end_date:       end,
    workouts:       enrichedWorkouts,
    energy_sessions: energySessions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    test_sessions: (testsRes.data ?? []).map((t: any) => ({
      id:              t.id,
      title:           t.title,
      type:            t.type,
      date:            t.date,
      completed:       t.completed,
      results_note:    t.results_note    ?? null,
      coach_validated: t.coach_validated ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    competitions: (compsRes.data ?? []).map((c: any) => ({
      id:              c.id,
      name:            c.name,
      type:            c.type,
      date:            c.date,
      location:        c.location        ?? null,
      athlete_comment: c.athlete_comment ?? null,
      priority:        c.priority        ?? null,
    })),
    avg_wellness:   avgWellness,
    daily_wellness: buildDailyWellness(startDate, endDate, mergedWH),
  };
}
