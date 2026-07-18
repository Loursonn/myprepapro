/**
 * Hooks React Query pour la banque de blocs spécifiques (specific_blocks).
 * Banque privée par coach (RLS coach_id = auth.uid()).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type { SpecificBlockRow, CreateSpecificBlockInput } from "@/types/specific";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useSpecificBlocks() {
  return useQuery<SpecificBlockRow[]>({
    queryKey: QK.specificBlocks,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db
        .from("specific_blocks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SpecificBlockRow[];
    },
  });
}

export function useCreateSpecificBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSpecificBlockInput) => {
      const { data, error } = await db
        .from("specific_blocks")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as SpecificBlockRow;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: QK.specificBlocks });
      const previous = qc.getQueryData<SpecificBlockRow[]>(QK.specificBlocks);
      const optimistic: SpecificBlockRow = {
        id: `__optimistic_${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...input,
      };
      qc.setQueryData<SpecificBlockRow[]>(QK.specificBlocks, (old = []) => [optimistic, ...old]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(QK.specificBlocks, ctx.previous);
      toast.error("Erreur lors de l'enregistrement du bloc");
    },
    onSuccess: () => toast.success("Bloc enregistré dans la banque"),
    onSettled: () => qc.invalidateQueries({ queryKey: QK.specificBlocks }),
  });
}

export function useUpdateSpecificBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SpecificBlockRow> & { id: string }) => {
      const { data, error } = await db
        .from("specific_blocks")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as SpecificBlockRow;
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: QK.specificBlocks });
      const previous = qc.getQueryData<SpecificBlockRow[]>(QK.specificBlocks);
      qc.setQueryData<SpecificBlockRow[]>(QK.specificBlocks, (old = []) =>
        old.map((b) => (b.id === id ? { ...b, ...patch } : b))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(QK.specificBlocks, ctx.previous);
      toast.error("Erreur lors de la mise à jour du bloc");
    },
    onSuccess: () => toast.success("Bloc mis à jour"),
    onSettled: () => qc.invalidateQueries({ queryKey: QK.specificBlocks }),
  });
}

export function useDeleteSpecificBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("specific_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QK.specificBlocks });
      const previous = qc.getQueryData<SpecificBlockRow[]>(QK.specificBlocks);
      qc.setQueryData<SpecificBlockRow[]>(QK.specificBlocks, (old = []) =>
        old.filter((b) => b.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(QK.specificBlocks, ctx.previous);
      toast.error("Erreur lors de la suppression du bloc");
    },
    onSuccess: () => toast.success("Bloc supprimé"),
    onSettled: () => qc.invalidateQueries({ queryKey: QK.specificBlocks }),
  });
}
