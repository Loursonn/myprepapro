import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type { CoachFeedbacks, AppFeedbackEntry } from "../types/athlete";

async function fetchCoachFeedback(athleteId: string): Promise<CoachFeedbacks> {
  const { data } = await supabase.from('app_data').select('value')
    .eq('athlete_id', athleteId).eq('key', 'asp:coach_feedback').maybeSingle();
  return (data?.value as CoachFeedbacks) || {};
}

async function fetchAppFeedback(athleteId: string): Promise<AppFeedbackEntry[]> {
  const { data } = await supabase.from('app_data').select('value')
    .eq('athlete_id', athleteId).eq('key', 'app:user_feedback').maybeSingle();
  return ((data?.value as { entries?: AppFeedbackEntry[] })?.entries) || [];
}

async function saveAppFeedback(athleteId: string, entries: AppFeedbackEntry[]) {
  await supabase.from('app_data').upsert(
    { athlete_id: athleteId, key: 'app:user_feedback', value: { entries }, updated_at: new Date().toISOString() },
    { onConflict: 'athlete_id,key' },
  );
}

export function useFeedbacks(athleteId: string) {
  const qc = useQueryClient();

  const { data: coachFeedbacks = {} } = useQuery<CoachFeedbacks>({
    queryKey: QK.coachFeedback(athleteId),
    queryFn: () => fetchCoachFeedback(athleteId),
    staleTime: 30_000,
  });

  const { data: appFeedbacks = [] } = useQuery<AppFeedbackEntry[]>({
    queryKey: QK.appFeedback(athleteId),
    queryFn: () => fetchAppFeedback(athleteId),
    staleTime: 60_000,
  });

  const addFeedbackMutation = useMutation({
    mutationFn: async (entry: AppFeedbackEntry) => {
      const newList = [...appFeedbacks, entry];
      await saveAppFeedback(athleteId, newList);
      return newList;
    },
    onMutate: async (entry) => {
      await qc.cancelQueries({ queryKey: QK.appFeedback(athleteId) });
      const previous = qc.getQueryData<AppFeedbackEntry[]>(QK.appFeedback(athleteId));
      qc.setQueryData(QK.appFeedback(athleteId), (old: AppFeedbackEntry[] = []) => [...old, entry]);
      return { previous };
    },
    onSuccess: (newList) => {
      qc.setQueryData(QK.appFeedback(athleteId), newList);
    },
    onError: (_err, _entry, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(QK.appFeedback(athleteId), ctx.previous);
      }
    },
  });

  return { coachFeedbacks, appFeedbacks, addAppFeedback: addFeedbackMutation.mutateAsync };
}
