import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type {
  MonthlyRetourData, DailyData, WorkoutDetail,
  PerformedExercise, PerformedSet, PlannedExercise, WellnessDay,
  EnergySessionDetail, WorkoutExerciseComment, FreeActivityDetail,
} from "@/features/shared/types/retours.types";
import type { SetRow, Exercise, BlockConfig, ArchivedBlock } from "@/features/shared/types/athlete";
import { startOfMonth, endOfMonth, format, eachDayOfInterval, addDays } from "date-fns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useMonthlyRetours(athleteId: string, monthStart: Date) {
  const monthKey = format(monthStart, "yyyy-MM");
  return useQuery({
    queryKey: QK.monthlyRetours(athleteId, monthKey),
    queryFn: () => fetchMonthData(athleteId, monthStart),
    staleTime: 1000 * 60 * 5,
    enabled: !!athleteId,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function calcWeekNum(dateStr: string, blockStartDate: string | null | undefined): number {
  if (!blockStartDate) return 1;
  const d = new Date(dateStr + "T12:00:00").getTime();
  const s = new Date(blockStartDate + "T12:00:00").getTime();
  const n = Math.floor((d - s) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return n >= 1 ? n : 1;
}

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
  Object.assign(merged, normalizeWH(currentWH));
  return merged;
}

function findBlockForDate(
  dateStr: string,
  currentBlockConfig: BlockConfig,
  currentExos: Record<string, Exercise[]>,
  currentSets: Record<string, SetRow[]>,
  blockHistory: ArchivedBlock[],
): { exos: Record<string, Exercise[]>; sets: Record<string, SetRow[]>; blockConfig: BlockConfig } {
  if (currentBlockConfig.startDate && dateStr >= currentBlockConfig.startDate) {
    return { exos: currentExos, sets: currentSets, blockConfig: currentBlockConfig };
  }
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
  return { exos: currentExos, sets: currentSets, blockConfig: currentBlockConfig };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toWellnessDay(entry: any): WellnessDay | null {
  if (!entry) return null;
  return {
    score:     entry.score     ?? 0,
    fatigue:   entry.fatigue   ?? 0,
    sommeil:   entry.sommeil   ?? 0,
    stress:    entry.stress    ?? 0,
    energie:   entry.energie   ?? 0,
    doms:      entry.doms,
    domsZones: entry.domsZones,
    coucher:   entry.coucher,
    reveil:    entry.reveil,
    sleepDur:  entry.sleepDur,
  };
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function fetchMonthData(athleteId: string, monthStart: Date): Promise<MonthlyRetourData> {
  const start = format(startOfMonth(monthStart), "yyyy-MM-dd");
  const end   = format(endOfMonth(monthStart),   "yyyy-MM-dd");

  // ── 1. Load app_data + DB tables in parallel ─────────────────────────────
  const [appDataRes, workoutsRes, energyRes, testsRes, compsRes] = await Promise.all([
    db.from("app_data")
      .select("key, value")
      .eq("athlete_id", athleteId)
      .in("key", ["asp:wh", "asp:sets", "asp:exos", "asp:blockConfig", "asp:blockHistory", "asp:freesess"]),

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

  // Extract app_data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appDataMap: Record<string, any> = Object.fromEntries(
    (appDataRes.data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentWH: Record<string, any>        = appDataMap["asp:wh"]          ?? {};
  const currentExos: Record<string, Exercise[]> = appDataMap["asp:exos"]      ?? {};
  const currentSets: Record<string, SetRow[]>   = appDataMap["asp:sets"]       ?? {};
  const currentBlockConfig: BlockConfig         = appDataMap["asp:blockConfig"] ?? {};
  const blockHistory: ArchivedBlock[]           = appDataMap["asp:blockHistory"] ?? [];

  const mergedWH = buildMergedWellness(currentWH, blockHistory);

  // ── 2. Exercise comments ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workoutList: any[] = workoutsRes.data ?? [];
  const workoutIds = workoutList.map((w) => w.id as string);

  const { data: commentsData = [] } = workoutIds.length > 0
    ? await db
        .from("workout_exercise_comments")
        .select("id, workout_log_id, exercise_id, exercise_name, comment, created_at, updated_at")
        .in("workout_log_id", workoutIds)
    : { data: [] as unknown[] };

  const commentsByWorkout: Record<string, WorkoutExerciseComment[]> = {};
  for (const c of commentsData as WorkoutExerciseComment[]) {
    if (!commentsByWorkout[c.workout_log_id]) commentsByWorkout[c.workout_log_id] = [];
    commentsByWorkout[c.workout_log_id].push(c);
  }

  // ── 3. Build workouts ────────────────────────────────────────────────────
  const workouts: WorkoutDetail[] = workoutList.map((w) => {
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

    const sessionType: 'muscu' | 'specific' = exercises.some(
      (ex) => ex.exType && ["halterophilie", "plio"].includes(ex.exType)
    ) ? "specific" : "muscu";

    return {
      id:             w.id,
      session_name:   w.session_name,
      scheduled_date: w.scheduled_date,
      status:         w.status,
      session_type:   sessionType,
      duration_s:     w.duration_s ?? null,
      notes:          w.notes      ?? null,
      rpe_score:      w.rpe_score  ?? null,
      wellness_day:   mergedWH[w.scheduled_date]?.score ?? null,
      planned_exercises:   planned,
      performed_exercises: performed,
      exercise_comments:   commentsByWorkout[w.id] ?? [],
    };
  });

  // ── 4. Energy sessions ───────────────────────────────────────────────────
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

  // ── 5. Daily data ────────────────────────────────────────────────────────
  const allDays = eachDayOfInterval({
    start: startOfMonth(new Date(start + "T12:00:00")),
    end:   endOfMonth(new Date(start + "T12:00:00")),
  });

  const compDates  = new Set((compsRes.data ?? []).map((c: { date: string }) => c.date));
  const testDates  = new Set((testsRes.data ?? []).map((t: { date: string }) => t.date));
  const doneByDate: Record<string, number> = {};
  for (const w of workouts) {
    if (w.status === "completed")
      doneByDate[w.scheduled_date] = (doneByDate[w.scheduled_date] ?? 0) + 1;
  }

  // Free activities
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allFree: any[] = appDataMap["asp:freesess"] ?? [];
  const freeActivities: FreeActivityDetail[] = allFree
    .filter((f) => f.date && f.date >= start && f.date <= end)
    .map((f) => ({
      id:         f.id,
      name:       f.name ?? f.sport ?? "Activité libre",
      date:       f.date,
      sport:      f.sport      ?? undefined,
      sportEmoji: f.sportEmoji ?? undefined,
      duration:   f.duration   ?? undefined,
      intensity:  f.intensity  ?? undefined,
      note:       f.note       ?? undefined,
    }));
  const freeByDate: Record<string, number> = {};
  for (const f of freeActivities) freeByDate[f.date] = (freeByDate[f.date] ?? 0) + 1;

  const daily_data: Record<string, DailyData> = {};
  for (const day of allDays) {
    const d = format(day, "yyyy-MM-dd");
    daily_data[d] = {
      date:                d,
      wellness:            toWellnessDay(mergedWH[d]),
      workouts_completed:  doneByDate[d]    ?? 0,
      has_competition:     compDates.has(d),
      has_test:            testDates.has(d),
      free_activity_count: freeByDate[d]    ?? 0,
    };
  }

  // ── 6. Aggregates ────────────────────────────────────────────────────────
  const wellnessScores = Object.values(daily_data)
    .map((d) => d.wellness?.score)
    .filter((s): s is number => s != null);
  const avg_wellness = wellnessScores.length > 0
    ? Math.round(wellnessScores.reduce((a, b) => a + b, 0) / wellnessScores.length)
    : null;

  const completed = workouts.filter((w) => w.status === "completed");

  return {
    month:      format(monthStart, "yyyy-MM"),
    start_date: start,
    end_date:   end,
    avg_wellness,
    workouts_completed: completed.length,
    workouts_total:     workouts.length,
    workouts_by_type: {
      muscu:    completed.filter((w) => w.session_type === "muscu").length,
      specific: completed.filter((w) => w.session_type === "specific").length,
      energy:   energySessions.filter((e) => e.completed).length,
    },
    tests_completed: (testsRes.data ?? []).filter((t: { completed: boolean }) => t.completed).length,
    daily_data,
    workouts,
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
    free_activities: freeActivities,
  };
}
