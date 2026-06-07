/**
 * Hooks React Query pour le module Roadmap.
 * Tables : roadmap_phases, roadmap_items, roadmap_votes
 *
 * Accès : is_certified_coach OU is_admin (géré côté RLS).
 * Mutations admin uniquement pour phases ; coaches peuvent suggérer des items (status='idea').
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type { RoadmapPhase, RoadmapItem, RoadmapCategory, RoadmapPriority, RoadmapItemStatus, RoadmapPhaseStatus } from "@/features/coach/types/roadmap";

// ─── Phases ───────────────────────────────────────────────────────────────────

async function fetchPhases(): Promise<RoadmapPhase[]> {
  const { data, error } = await supabase
    .from("roadmap_phases")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as RoadmapPhase[];
}

export function useRoadmapPhases() {
  return useQuery<RoadmapPhase[]>({
    queryKey: QK.roadmapPhases,
    queryFn:  fetchPhases,
    staleTime: 60_000,
  });
}

// ─── Items (toutes phases) ────────────────────────────────────────────────────

async function fetchAllItems(): Promise<RoadmapItem[]> {
  const { data, error } = await supabase
    .from("roadmap_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as RoadmapItem[];
}

export function useRoadmapItems() {
  return useQuery<RoadmapItem[]>({
    queryKey: QK.roadmapItems(),
    queryFn:  fetchAllItems,
    staleTime: 30_000,
  });
}

// ─── Votes (de l'utilisateur courant) ─────────────────────────────────────────

async function fetchMyVotes(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("roadmap_votes")
    .select("item_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r: { item_id: string }) => r.item_id);
}

export function useMyRoadmapVotes(userId: string | undefined) {
  return useQuery<string[]>({
    queryKey: QK.roadmapVotes(userId ?? ""),
    queryFn:  () => fetchMyVotes(userId!),
    enabled:  !!userId,
    staleTime: 30_000,
  });
}

// ─── Vote toggle ──────────────────────────────────────────────────────────────

export function useToggleVote(userId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, voted }: { itemId: string; voted: boolean }) => {
      if (!userId) throw new Error("Non authentifié");
      if (voted) {
        const { error } = await supabase
          .from("roadmap_votes")
          .delete()
          .eq("item_id", itemId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("roadmap_votes")
          .insert({ item_id: itemId, user_id: userId });
        if (error) throw error;
      }
    },

    onMutate: async ({ itemId, voted }) => {
      const key = QK.roadmapVotes(userId ?? "");
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<string[]>(key) ?? [];
      qc.setQueryData<string[]>(key, voted
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
      );
      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(QK.roadmapVotes(userId ?? ""), ctx.prev);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: QK.roadmapVotes(userId ?? "") });
    },
  });
}

// ─── Create phase (admin) ─────────────────────────────────────────────────────

export type CreatePhaseInput = Pick<RoadmapPhase, 'name' | 'quarter' | 'status' | 'sort_order'> & {
  description?: string | null;
};

export function useCreatePhase() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePhaseInput) => {
      const { data, error } = await supabase
        .from("roadmap_phases")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RoadmapPhase;
    },
    onSuccess: () => { toast.success("Phase créée"); },
    onError:   () => { toast.error("Erreur lors de la création de la phase"); },
    onSettled: () => { qc.invalidateQueries({ queryKey: QK.roadmapPhases }); },
  });
}

// ─── Update phase (admin) ─────────────────────────────────────────────────────

export type UpdatePhaseInput = Partial<Omit<RoadmapPhase, 'id' | 'created_at' | 'updated_at'>> & { id: string };

export function useUpdatePhase() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdatePhaseInput) => {
      const { data, error } = await supabase
        .from("roadmap_phases")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RoadmapPhase;
    },
    onMutate: async ({ id, ...updates }) => {
      await qc.cancelQueries({ queryKey: QK.roadmapPhases });
      const prev = qc.getQueryData<RoadmapPhase[]>(QK.roadmapPhases);
      qc.setQueryData<RoadmapPhase[]>(QK.roadmapPhases,
        (old) => old?.map((p) => p.id === id ? { ...p, ...updates } : p)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.roadmapPhases, ctx.prev);
      toast.error("Erreur lors de la mise à jour");
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: QK.roadmapPhases }); },
  });
}

// ─── Delete phase (admin) ─────────────────────────────────────────────────────

export function useDeletePhase() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roadmap_phases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Phase supprimée"); },
    onError:   () => { toast.error("Erreur lors de la suppression"); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QK.roadmapPhases });
      qc.invalidateQueries({ queryKey: QK.roadmapItems() });
    },
  });
}

// ─── Create item ──────────────────────────────────────────────────────────────

export type CreateItemInput = {
  phase_id?:    string | null;
  title:        string;
  description?: string | null;
  category:     RoadmapCategory;
  priority:     RoadmapPriority;
  status:       RoadmapItemStatus;
  sort_order?:  number;
};

export function useCreateItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateItemInput) => {
      const { data, error } = await supabase
        .from("roadmap_items")
        .insert({ ...input, sort_order: input.sort_order ?? 0 })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RoadmapItem;
    },
    onSuccess: () => { toast.success("Item ajouté"); },
    onError:   () => { toast.error("Erreur lors de l'ajout"); },
    onSettled: () => { qc.invalidateQueries({ queryKey: QK.roadmapItems() }); },
  });
}

// ─── Update item (admin) ──────────────────────────────────────────────────────

export type UpdateItemInput = Partial<Omit<RoadmapItem, 'id' | 'created_at' | 'updated_at' | 'vote_count' | 'user_voted'>> & { id: string };

export function useUpdateItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateItemInput) => {
      const { data, error } = await supabase
        .from("roadmap_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as RoadmapItem;
    },
    onMutate: async ({ id, ...updates }) => {
      await qc.cancelQueries({ queryKey: QK.roadmapItems() });
      const prev = qc.getQueryData<RoadmapItem[]>(QK.roadmapItems());
      qc.setQueryData<RoadmapItem[]>(QK.roadmapItems(),
        (old) => old?.map((item) => item.id === id ? { ...item, ...updates } : item)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.roadmapItems(), ctx.prev);
      toast.error("Erreur lors de la mise à jour");
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: QK.roadmapItems() }); },
  });
}

// ─── Delete item (admin) ──────────────────────────────────────────────────────

export function useDeleteItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roadmap_items").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QK.roadmapItems() });
      const prev = qc.getQueryData<RoadmapItem[]>(QK.roadmapItems());
      qc.setQueryData<RoadmapItem[]>(QK.roadmapItems(), (old) => old?.filter((i) => i.id !== id));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.roadmapItems(), ctx.prev);
      toast.error("Erreur lors de la suppression");
    },
    onSuccess: () => { toast.success("Item supprimé"); },
    onSettled: () => { qc.invalidateQueries({ queryKey: QK.roadmapItems() }); },
  });
}

// ─── Fetch vote counts (server-side aggregation) ──────────────────────────────

export async function fetchVoteCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("roadmap_votes")
    .select("item_id");
  if (error) throw error;
  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: { item_id: string }) => {
    counts[row.item_id] = (counts[row.item_id] ?? 0) + 1;
  });
  return counts;
}

export function useVoteCounts() {
  return useQuery<Record<string, number>>({
    queryKey: ['roadmap-vote-counts'],
    queryFn:  fetchVoteCounts,
    staleTime: 30_000,
  });
}

// ─── Update phase status (admin shortcut) ─────────────────────────────────────

export function useUpdatePhaseStatus() {
  const update = useUpdatePhase();
  return (id: string, status: RoadmapPhaseStatus) => update.mutate({ id, status });
}
