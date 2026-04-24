import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Competition, CompetitionInsert } from '@/types/planning';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useCompetitions(athleteId: string, seasonId?: string | null) {
  return useQuery<Competition[]>({
    queryKey: ['competitions', athleteId, seasonId ?? 'all'],
    queryFn: async () => {
      let query = db
        .from('competitions')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('date', { ascending: true });

      if (seasonId) {
        query = query.eq('season_id', seasonId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Competition[];
    },
    enabled: !!athleteId,
  });
}

export function useCreateCompetition() {
  const qc = useQueryClient();
  return useMutation<Competition, Error, CompetitionInsert>({
    mutationFn: async (comp) => {
      const { data, error } = await db
        .from('competitions')
        .insert(comp)
        .select()
        .single();
      if (error) throw error;
      return data as Competition;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['competitions', data.athlete_id] });
    },
  });
}

export function useUpdateCompetition() {
  const qc = useQueryClient();
  return useMutation<Competition, Error, { id: string; updates: Partial<Competition> }>({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await db
        .from('competitions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Competition;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['competitions', data.athlete_id] });
    },
  });
}

export function useDeleteCompetition() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; athlete_id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await db.from('competitions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['competitions', vars.athlete_id] });
    },
  });
}
