import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MicroStats {
  completed: number;
  planned:   number;
  avg_rpe:   number | null;
  avg_wellness: number | null;
}

export function useMicroStats(
  athleteId: string,
  startDate: string,
  endDate: string,
) {
  return useQuery<MicroStats>({
    queryKey: ["micro-stats", athleteId, startDate, endDate],
    enabled: !!athleteId && !!startDate,
    staleTime: 300_000,
    queryFn: async () => {
      const [logsRes, wellnessRes] = await Promise.all([
        supabase
          .from("workout_logs")
          .select("status, workout_rpe(rpe_score)")
          .eq("athlete_id", athleteId)
          .gte("scheduled_date", startDate)
          .lte("scheduled_date", endDate),
        supabase
          .from("wellness_logs")
          .select("energy, fatigue, stress, sleep")
          .eq("athlete_id", athleteId)
          .gte("date", startDate)
          .lte("date", endDate),
      ]);

      const logs = logsRes.data ?? [];
      const completed = logs.filter((l) => l.status === "completed").length;
      const planned   = logs.length;

      const rpeValues = logs.flatMap((l) => {
        if (!Array.isArray(l.workout_rpe) || l.workout_rpe.length === 0) return [];
        const r = (l.workout_rpe[0] as { rpe_score: number }).rpe_score;
        return r != null ? [r] : [];
      });
      const avg_rpe = rpeValues.length > 0
        ? rpeValues.reduce((s, v) => s + v, 0) / rpeValues.length
        : null;

      const wellness = wellnessRes.data ?? [];
      const wellnessScores = wellness.map((w) => {
        const vals = [w.energy, w.fatigue != null ? 10 - w.fatigue : null, w.stress != null ? 10 - w.stress : null, w.sleep]
          .filter((v): v is number => v != null);
        return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      }).filter((v): v is number => v != null);

      const avg_wellness = wellnessScores.length > 0
        ? wellnessScores.reduce((s, v) => s + v, 0) / wellnessScores.length
        : null;

      return { completed, planned, avg_rpe, avg_wellness };
    },
  });
}
