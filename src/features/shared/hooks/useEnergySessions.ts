import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type { EnergySession } from "../types/athlete";

async function fetchEnergyData(athleteId: string) {
  const [wp, dp, es] = await Promise.all([
    supabase.from('app_data').select('value').eq('athlete_id', athleteId).eq('key', 'asp:energy_week_plan').maybeSingle(),
    supabase.from('app_data').select('value').eq('athlete_id', athleteId).eq('key', 'asp:energy_day_plan').maybeSingle(),
    supabase.from('energy_session_config').select('id,session_key,session_label,appareil_types').eq('athlete_id', athleteId),
  ]);
  return {
    weekPlan: (wp.data?.value as Record<string, unknown>) || {},
    dayPlan: (dp.data?.value as Record<string, unknown>) || {},
    sessions: (es.data || []) as EnergySession[],
  };
}

async function saveEnergyPlan(athleteId: string, key: string, value: unknown) {
  await supabase.from('app_data').upsert(
    { athlete_id: athleteId, key, value, updated_at: new Date().toISOString() },
    { onConflict: 'athlete_id,key' },
  );
}

export function useEnergySessions(athleteId: string) {
  const qc = useQueryClient();
  const { data, isSuccess } = useQuery({
    queryKey: QK.energyPlan(athleteId),
    queryFn: () => fetchEnergyData(athleteId),
    staleTime: 60_000,
  });

  // Local mutable state (optimistic updates before refetch)
  const [energyWeekPlan, setEnergyWeekPlan] = useState<Record<string, unknown>>({});
  const [energyDayPlan, setEnergyDayPlan] = useState<Record<string, unknown>>({});
  const [energySessions, setEnergySessions] = useState<EnergySession[]>([]);
  const [energyEditorKey, setEnergyEditorKey] = useState<string | null>(null);
  const [energySessionsLoaded, setEnergySessionsLoaded] = useState(false);

  useEffect(() => {
    if (isSuccess && data) {
      setEnergyWeekPlan(data.weekPlan);
      setEnergyDayPlan(data.dayPlan);
      setEnergySessions(data.sessions);
      setEnergySessionsLoaded(true);
    }
  }, [isSuccess, data]);

  const savePlanMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => saveEnergyPlan(athleteId, key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.energyPlan(athleteId) }),
  });

  const updateWeekPlan = (v: Record<string, unknown>) => {
    setEnergyWeekPlan(v);
    savePlanMutation.mutate({ key: 'asp:energy_week_plan', value: v });
  };

  const updateDayPlan = (v: Record<string, unknown>) => {
    setEnergyDayPlan(v);
    savePlanMutation.mutate({ key: 'asp:energy_day_plan', value: v });
  };

  return {
    energySessions, setEnergySessions, energySessionsLoaded, setEnergySessionsLoaded,
    energyWeekPlan, setEnergyWeekPlan: updateWeekPlan,
    energyDayPlan, setEnergyDayPlan: updateDayPlan,
    energyEditorKey, setEnergyEditorKey,
  };
}
