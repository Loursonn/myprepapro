import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { QK } from '@/lib/queryKeys';
import type { TestCategory } from '@/features/shared/types/tests';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface ProfileItem {
  id: string;
  athlete_id: string;
  category: TestCategory;
  label: string;
  rating: number | null;   // /5
  note: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProfileItemInput {
  category: TestCategory;
  label: string;
  rating: number | null;
  note: string | null;
}

export function useProfileItems(athleteId: string) {
  return useQuery({
    queryKey: QK.profileItems(athleteId),
    queryFn: async (): Promise<ProfileItem[]> => {
      const { data, error } = await db
        .from('athlete_profile_items')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('category')
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as ProfileItem[];
    },
    enabled: !!athleteId,
    staleTime: 30_000,
  });
}

export function useCreateProfileItem(athleteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileItemInput) => {
      const { error } = await db.from('athlete_profile_items').insert({
        athlete_id: athleteId,
        category: input.category,
        label: input.label.trim(),
        rating: input.rating,
        note: input.note?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.profileItems(athleteId) }),
    onError: () => toast.error("Erreur lors de l'ajout"),
  });
}

export function useUpdateProfileItem(athleteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ProfileItemInput & { id: string }) => {
      const { error } = await db.from('athlete_profile_items').update({
        category: input.category,
        label: input.label.trim(),
        rating: input.rating,
        note: input.note?.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.profileItems(athleteId) }),
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });
}

export function useDeleteProfileItem(athleteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('athlete_profile_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.profileItems(athleteId) }),
    onError: () => toast.error('Erreur lors de la suppression'),
  });
}
