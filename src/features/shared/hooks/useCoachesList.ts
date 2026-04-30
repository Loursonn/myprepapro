import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface CoachRow {
  id: string;
  full_name: string;
  coach_code: string | null;
  created_at: string;
  is_admin: boolean;
  is_certified_coach: boolean;
  athlete_count: number;
}

const QK_COACHES = ['coaches_list'] as const;

export function useCoachesList() {
  return useQuery({
    queryKey: QK_COACHES,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_coaches_list');
      if (error) throw error;
      return (data ?? []) as CoachRow[];
    },
    staleTime: 60_000,
  });
}

export function useToggleCertifiedCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetId, certified }: { targetId: string; certified: boolean }) => {
      const { error } = await supabase.rpc('toggle_coach_certification', {
        p_target_id: targetId,
        p_certified: certified,
      });
      if (error) throw error;
    },
    onMutate: async ({ targetId, certified }) => {
      await qc.cancelQueries({ queryKey: QK_COACHES });
      const previous = qc.getQueryData<CoachRow[]>(QK_COACHES);
      qc.setQueryData<CoachRow[]>(QK_COACHES, (old) =>
        (old ?? []).map(c => c.id === targetId ? { ...c, is_certified_coach: certified } : c),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(QK_COACHES, ctx.previous);
      toast.error('Erreur lors de la mise à jour');
    },
    onSuccess: (_data, { certified }) => {
      qc.invalidateQueries({ queryKey: QK_COACHES });
      toast.success(certified ? 'Coach certifié' : 'Certification retirée');
    },
  });
}
