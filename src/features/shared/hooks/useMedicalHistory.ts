import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { MedicalHistory, MedicalHistoryInput } from '@/features/shared/types/medical';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const QK_MEDICAL = (athleteId: string) => ['medicalHistory', athleteId];

export function useMedicalHistory(athleteId: string | undefined) {
  return useQuery<MedicalHistory | null>({
    queryKey: QK_MEDICAL(athleteId ?? ''),
    queryFn: async () => {
      const { data, error } = await db
        .from('medical_history')
        .select('*')
        .eq('athlete_id', athleteId)
        .maybeSingle();
      if (error) throw error;
      return (data as MedicalHistory) ?? null;
    },
    enabled: !!athleteId,
    staleTime: 60_000,
  });
}

export function useUpsertMedicalHistory(athleteId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<MedicalHistoryInput, 'athlete_id'>) => {
      const payload = { ...input, athlete_id: athleteId };
      const { data, error } = await db
        .from('medical_history')
        .upsert(payload, { onConflict: 'athlete_id' })
        .select()
        .single();
      if (error) throw error;
      return data as MedicalHistory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK_MEDICAL(athleteId) });
      toast.success('Antécédents médicaux enregistrés');
    },
    onError: (err: unknown) => {
      console.error('[medical save error]', err);
      toast.error('Erreur lors de la sauvegarde');
    },
  });
}
