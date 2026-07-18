/**
 * Hooks React Query pour les référentiels de la Banque Spécifique :
 * sports (specific_sports) et qualités physiques (physical_qualities).
 * Chaque référentiel = défauts globaux (coach_id NULL) + customs du coach.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type { SpecificSport, PhysicalQuality } from "@/types/specific";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Sports ────────────────────────────────────────────────────────────────────

export function useSpecificSports() {
  return useQuery<SpecificSport[]>({
    queryKey: QK.specificSports,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await db
        .from("specific_sports")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as SpecificSport[];
    },
  });
}

export function useCreateSport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, coachId, color }: { name: string; coachId: string; color?: string }) => {
      const { data, error } = await db
        .from("specific_sports")
        .insert({ name: name.trim(), slug: slugify(name), coach_id: coachId, color: color ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as SpecificSport;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.specificSports });
      toast.success("Sport ajouté");
    },
    onError: () => toast.error("Erreur lors de l'ajout du sport"),
  });
}

export function useDeleteSport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("specific_sports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.specificSports });
      toast.success("Sport supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression du sport"),
  });
}

// ── Qualités physiques ────────────────────────────────────────────────────────

export function usePhysicalQualities() {
  return useQuery<PhysicalQuality[]>({
    queryKey: QK.physicalQualities,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await db
        .from("physical_qualities")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as PhysicalQuality[];
    },
  });
}

export function useCreateQuality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, coachId }: { name: string; coachId: string }) => {
      const { data, error } = await db
        .from("physical_qualities")
        .insert({ name: name.trim(), slug: slugify(name), coach_id: coachId })
        .select()
        .single();
      if (error) throw error;
      return data as PhysicalQuality;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.physicalQualities });
      toast.success("Qualité ajoutée");
    },
    onError: () => toast.error("Erreur lors de l'ajout de la qualité"),
  });
}

export function useDeleteQuality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("physical_qualities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.physicalQualities });
      toast.success("Qualité supprimée");
    },
    onError: () => toast.error("Erreur lors de la suppression de la qualité"),
  });
}
