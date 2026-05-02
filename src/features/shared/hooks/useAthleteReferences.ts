/**
 * useAthleteReferences — charge les performances de référence actives d'un athlète.
 *
 * Retourne une map metric_name → value (ex: { VMA: 18.5, FCmax: 192, FTP: 280 })
 * utilisable pour enrichir les calculs d'intensité dans le module énergie.
 *
 * Source : performance_logs WHERE athlete_id = ? AND is_active_reference = true
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AthleteReferences = Record<string, number>;

async function fetchReferences(athleteId: string): Promise<AthleteReferences> {
  const { data, error } = await supabase
    .from("performance_logs")
    .select("metric_name, value, unit")
    .eq("athlete_id", athleteId)
    .eq("is_active_reference", true);

  if (error) throw error;

  const refs: AthleteReferences = {};
  for (const row of data ?? []) {
    refs[row.metric_name] = row.value;
  }
  return refs;
}

export function useAthleteReferences(athleteId: string | null | undefined) {
  return useQuery<AthleteReferences>({
    queryKey: ["athlete-references", athleteId ?? ""],
    queryFn: () => fetchReferences(athleteId!),
    enabled: !!athleteId,
    staleTime: 5 * 60_000,  // 5 min — références peu volatiles
  });
}
