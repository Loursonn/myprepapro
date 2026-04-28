import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Macrocycle {
  id: string; athlete_id: string; coach_id: string;
  name: string; start_date: string; end_date: string; objective?: string | null;
}

export interface Mesocycle {
  id: string; macrocycle_id: string;
  name: string; start_date: string; end_date: string;
  objective?: string | null;
  volume_config?: { type?: string; weeks?: number[] } | null;
  intensity_config?: { zones?: string[]; distribution?: number[] } | null;
  frequency?: number | null; deload_week?: number | null;
}

export interface Cycle {
  id: string; mesocycle_id: string;
  name: string; start_date: string; end_date: string;
  objective?: string | null;
}

export interface Microcycle {
  id: string; cycle_id: string;
  week_number: number; start_date: string; end_date: string; is_deload: boolean;
}

export interface Competition {
  id: string; name: string; date: string;
  priority?: string | null; location?: string | null;
}

export interface TimelineTestSession {
  id: string; title: string; date: string; type: string; completed: boolean;
}

export interface TimelineData {
  macrocycles:  Macrocycle[];
  mesocycles:   Mesocycle[];
  cycles:       Cycle[];
  microcycles:  Microcycle[];
  competitions: Competition[];
  tests:        TimelineTestSession[];
}

// ── Query ─────────────────────────────────────────────────────────────────────

export function useTimelineData(
  athleteId: string,
  range: { start: Date; end: Date },
) {
  const start = format(range.start, "yyyy-MM-dd");
  const end   = format(range.end,   "yyyy-MM-dd");

  return useQuery({
    queryKey: ["timeline-data", athleteId, start, end],
    enabled: !!athleteId,
    staleTime: 60_000,
    queryFn: async (): Promise<TimelineData> => {
      const [macroRes, compRes, testRes] = await Promise.all([
        supabase
          .from("macrocycles")
          .select("*")
          .eq("athlete_id", athleteId)
          .or(`start_date.lte.${end},end_date.gte.${start}`)
          .order("start_date"),

        supabase
          .from("competitions")
          .select("id, name, date, priority, location")
          .eq("athlete_id", athleteId)
          .gte("date", start)
          .lte("date", end)
          .order("date"),

        supabase
          .from("test_sessions")
          .select("id, title, date, type, completed")
          .eq("athlete_id", athleteId)
          .gte("date", start)
          .lte("date", end)
          .order("date"),
      ]);

      const macros = (macroRes.data ?? []) as Macrocycle[];
      const macroIds = macros.map((m) => m.id);

      // Fetch mesocycles for those macros
      let mesos: Mesocycle[] = [];
      let cycles: Cycle[]    = [];
      let micros: Microcycle[] = [];

      if (macroIds.length > 0) {
        const mesoRes = await supabase
          .from("mesocycles")
          .select("*")
          .in("macrocycle_id", macroIds)
          .order("start_date");

        mesos = (mesoRes.data ?? []) as Mesocycle[];
        const mesoIds = mesos.map((m) => m.id);

        if (mesoIds.length > 0) {
          const cycleRes = await supabase
            .from("cycles")
            .select("*")
            .in("mesocycle_id", mesoIds)
            .order("start_date");

          cycles = (cycleRes.data ?? []) as Cycle[];
          const cycleIds = cycles.map((c) => c.id);

          if (cycleIds.length > 0) {
            const microRes = await supabase
              .from("microcycles")
              .select("*")
              .in("cycle_id", cycleIds)
              .order("start_date");

            micros = (microRes.data ?? []) as Microcycle[];
          }
        }
      }

      return {
        macrocycles:  macros,
        mesocycles:   mesos,
        cycles,
        microcycles:  micros,
        competitions: (compRes.data ?? []) as Competition[],
        tests:        (testRes.data ?? []) as TimelineTestSession[],
      };
    },
  });
}

// ── Cycle sessions ────────────────────────────────────────────────────────────

export interface CycleSession {
  id: string;
  session_name: string;
  scheduled_date: string;
  status: string;
  rpe: number | null;
}

export function useCycleSessions(athleteId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["cycle-sessions", athleteId, startDate, endDate],
    enabled: !!athleteId && !!startDate && !!endDate,
    staleTime: 60_000,
    queryFn: async (): Promise<CycleSession[]> => {
      const { data } = await supabase
        .from("workout_logs")
        .select("id, session_name, scheduled_date, status, workout_rpe(rpe_score)")
        .eq("athlete_id", athleteId)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .order("scheduled_date");

      return (data ?? []).map((w) => ({
        id: w.id,
        session_name: w.session_name,
        scheduled_date: w.scheduled_date,
        status: w.status,
        rpe: Array.isArray(w.workout_rpe) && w.workout_rpe.length > 0
          ? (w.workout_rpe[0] as { rpe_score: number }).rpe_score
          : null,
      }));
    },
  });
}

// ── Microcycle day data ───────────────────────────────────────────────────────

export interface MicroDayData {
  workouts: Array<{
    id: string; session_name: string; status: string;
    rpe: number | null;
  }>;
}

export function useMicroDayData(athleteId: string, dateStr: string) {
  return useQuery({
    queryKey: ["micro-day", athleteId, dateStr],
    enabled: !!athleteId && !!dateStr,
    staleTime: 60_000,
    queryFn: async (): Promise<MicroDayData> => {
      const res = await supabase
        .from("workout_logs")
        .select("id, session_name, status, workout_rpe(rpe_score)")
        .eq("athlete_id", athleteId)
        .eq("scheduled_date", dateStr);

      const workouts = (res.data ?? []).map((w) => ({
        id: w.id,
        session_name: w.session_name,
        status: w.status,
        rpe: Array.isArray(w.workout_rpe) && w.workout_rpe.length > 0
          ? (w.workout_rpe[0] as { rpe_score: number }).rpe_score
          : null,
      }));

      return { workouts };
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

type DateUpdate = { id: string; start_date: string; end_date: string };
type WithObjective = { objective?: string | null };

async function patchRow(table: string, id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) throw error;
}

export function useUpdateMacrocycle(athleteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: DateUpdate & WithObjective) => {
      const { id, ...rest } = v;
      return patchRow("macrocycles", id, rest);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timeline-data", athleteId] }),
    onError:   () => toast.error("Erreur mise à jour macrocycle"),
  });
}

export function useUpdateMesocycle(athleteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: DateUpdate & WithObjective & Partial<Omit<Mesocycle, "id" | "macrocycle_id" | "start_date" | "end_date">>) => {
      const { id, ...rest } = v;
      return patchRow("mesocycles", id, rest);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timeline-data", athleteId] }),
    onError:   () => toast.error("Erreur mise à jour mésocycle"),
  });
}

export function useUpdateCycle(athleteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: DateUpdate & WithObjective) => {
      const { id, ...rest } = v;
      return patchRow("cycles", id, rest);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timeline-data", athleteId] }),
    onError:   () => toast.error("Erreur mise à jour cycle"),
  });
}

export function useUpdateMicrocycle(athleteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: DateUpdate) =>
      makeDateMutation("microcycles", "timeline-data", athleteId, qc)(v),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["timeline-data", athleteId] }),
    onError:    () => toast.error("Erreur mise à jour microcycle"),
  });
}
