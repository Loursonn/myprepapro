/**
 * Hooks React Query pour la banque de méthodes d'entraînement.
 * Table : training_methods
 * Mutations avec optimistic updates + rollback sur erreur.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type { TrainingMethod, MethodScope, MethodCategory } from "@/types/trainingMethods";

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface TrainingMethodFilters {
  scope?: MethodScope;
  category?: MethodCategory;
  is_official?: boolean;
  search?: string;
}

// ─── Query functions ──────────────────────────────────────────────────────────

async function fetchTrainingMethods(): Promise<TrainingMethod[]> {
  const { data, error } = await supabase
    .from("training_methods")
    .select("*")
    .order("is_official", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as TrainingMethod[];
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useTrainingMethods(filters?: TrainingMethodFilters) {
  return useQuery<TrainingMethod[]>({
    queryKey: QK.trainingMethods(filters),
    queryFn: fetchTrainingMethods,
    staleTime: 60_000,
    select: (data) => {
      let list = data;
      if (filters?.scope)      list = list.filter((m) => m.scope === filters.scope);
      if (filters?.category)   list = list.filter((m) => m.category === filters.category);
      if (filters?.is_official !== undefined)
        list = list.filter((m) => m.is_official === filters.is_official);
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        list = list.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return list;
    },
  });
}

// ─── Create ───────────────────────────────────────────────────────────────────

export type CreateTrainingMethodInput = Omit<TrainingMethod, "id" | "created_at" | "updated_at" | "is_official">;

export function useCreateTrainingMethod() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTrainingMethodInput) => {
      const { data, error } = await supabase
        .from("training_methods")
        .insert({
          name:        input.name,
          description: input.description ?? null,
          scope:       input.scope,
          category:    input.category,
          config:      input.config as unknown as Record<string, unknown>,
          is_official: false,
          created_by:  input.created_by ?? null,
          tags:        input.tags,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as TrainingMethod;
    },

    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["training_methods"] });
      const prev = qc.getQueriesData<TrainingMethod[]>({ queryKey: ["training_methods"] });

      const optimistic: TrainingMethod = {
        ...input,
        id: `optimistic-${Date.now()}`,
        is_official: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      qc.setQueriesData<TrainingMethod[]>(
        { queryKey: ["training_methods"] },
        (old) => (old ? [optimistic, ...old] : [optimistic])
      );

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        ctx.prev.forEach(([key, data]) => qc.setQueryData(key, data));
      }
      toast.error("Erreur lors de la création de la méthode");
    },

    onSuccess: (method) => {
      toast.success(`Méthode "${method.name}" créée`);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["training_methods"] });
    },
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────

export type UpdateTrainingMethodInput = Partial<Omit<TrainingMethod, "id" | "created_at" | "is_official">> & { id: string };

export function useUpdateTrainingMethod() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTrainingMethodInput) => {
      const { data, error } = await supabase
        .from("training_methods")
        .update({
          ...(updates.name        !== undefined && { name:        updates.name }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.scope       !== undefined && { scope:       updates.scope }),
          ...(updates.category    !== undefined && { category:    updates.category }),
          ...(updates.config      !== undefined && { config:      updates.config as unknown as Record<string, unknown> }),
          ...(updates.tags        !== undefined && { tags:        updates.tags }),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as TrainingMethod;
    },

    onMutate: async ({ id, ...updates }) => {
      await qc.cancelQueries({ queryKey: ["training_methods"] });
      const prev = qc.getQueriesData<TrainingMethod[]>({ queryKey: ["training_methods"] });

      qc.setQueriesData<TrainingMethod[]>(
        { queryKey: ["training_methods"] },
        (old) => old?.map((m) => (m.id === id ? { ...m, ...updates, updated_at: new Date().toISOString() } : m))
      );

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        ctx.prev.forEach(([key, data]) => qc.setQueryData(key, data));
      }
      toast.error("Erreur lors de la mise à jour de la méthode");
    },

    onSuccess: (method) => {
      toast.success(`Méthode "${method.name}" mise à jour`);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["training_methods"] });
    },
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function useDeleteTrainingMethod() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("training_methods")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },

    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["training_methods"] });
      const prev = qc.getQueriesData<TrainingMethod[]>({ queryKey: ["training_methods"] });

      qc.setQueriesData<TrainingMethod[]>(
        { queryKey: ["training_methods"] },
        (old) => old?.filter((m) => m.id !== id)
      );

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        ctx.prev.forEach(([key, data]) => qc.setQueryData(key, data));
      }
      toast.error("Erreur lors de la suppression de la méthode");
    },

    onSuccess: () => {
      toast.success("Méthode supprimée");
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["training_methods"] });
    },
  });
}

// ─── Duplicate ────────────────────────────────────────────────────────────────

export function useDuplicateTrainingMethod() {
  const create = useCreateTrainingMethod();

  return useMutation({
    mutationFn: async (method: TrainingMethod) => {
      return create.mutateAsync({
        name:        `${method.name} (copie)`,
        description: method.description,
        scope:       method.scope,
        category:    method.category,
        config:      method.config,
        created_by:  method.created_by,
        tags:        method.tags,
      });
    },
  });
}
