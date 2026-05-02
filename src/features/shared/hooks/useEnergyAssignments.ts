/**
 * Hooks React Query pour les assignations de séances énergétiques à un athlète.
 *
 * Repose sur energy_session_assignments.
 * RLS : athlète voit ses propres données, coach voit ses athlètes, admin voit tout.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import type {
  EnergySessionAssignmentRow,
  CreateAssignmentInput,
  AssignmentStatus,
} from "@/types/energy";

// ─────────────────────────────────────────────────────────────────────────────
// Query functions
// ─────────────────────────────────────────────────────────────────────────────

export interface DateRange {
  from: string;  // ISO date YYYY-MM-DD
  to: string;    // ISO date YYYY-MM-DD
}

async function fetchEnergyAssignments(
  athleteId: string,
  dateRange?: DateRange,
): Promise<EnergySessionAssignmentRow[]> {
  let q = supabase
    .from('energy_session_assignments')
    .select('*, energy_sessions(*)')
    .eq('athlete_id', athleteId)
    .order('scheduled_date', { ascending: true });

  if (dateRange) {
    q = q.gte('scheduled_date', dateRange.from).lte('scheduled_date', dateRange.to);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as EnergySessionAssignmentRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Query
// ─────────────────────────────────────────────────────────────────────────────

export function useEnergyAssignments(athleteId: string | null | undefined, dateRange?: DateRange) {
  return useQuery<EnergySessionAssignmentRow[]>({
    queryKey: dateRange
      ? [...QK.energyAssignments(athleteId ?? ''), dateRange]
      : QK.energyAssignments(athleteId ?? ''),
    queryFn: () => fetchEnergyAssignments(athleteId!, dateRange),
    enabled: !!athleteId,
    staleTime: 60_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

export function useAssignEnergySession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAssignmentInput) => {
      const { data, error } = await supabase
        .from('energy_session_assignments')
        .insert(input)
        .select('*, energy_sessions(*)')
        .single();
      if (error) throw error;
      return data as unknown as EnergySessionAssignmentRow;
    },
    onMutate: async (input) => {
      const key = QK.energyAssignments(input.athlete_id);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<EnergySessionAssignmentRow[]>(key);
      const optimistic: EnergySessionAssignmentRow = {
        id: `__optimistic_${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...input,
      };
      qc.setQueryData<EnergySessionAssignmentRow[]>(key, (old = []) => [...old, optimistic]);
      return { previous, athleteId: input.athlete_id };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(QK.energyAssignments(ctx.athleteId), ctx.previous);
      }
      toast.error("Erreur lors de l'assignation de la séance");
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: QK.energyAssignments(input.athlete_id) });
      // Invalide aussi le calendrier unifié pour que la vue mois se rafraîchisse
      qc.invalidateQueries({ queryKey: ["cal", input.athlete_id] });
      toast.success("Séance assignée");
    },
  });
}

export function useUpdateEnergyAssignment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      athleteId,
      ...patch
    }: Partial<EnergySessionAssignmentRow> & { id: string; athleteId: string }) => {
      const { data, error } = await supabase
        .from('energy_session_assignments')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, energy_sessions(*)')
        .single();
      if (error) throw error;
      return data as unknown as EnergySessionAssignmentRow;
    },
    onMutate: async ({ id, athleteId, ...patch }) => {
      const key = QK.energyAssignments(athleteId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<EnergySessionAssignmentRow[]>(key);
      qc.setQueryData<EnergySessionAssignmentRow[]>(key, (old = []) =>
        old.map((a) => (a.id === id ? { ...a, ...patch } : a))
      );
      return { previous, athleteId };
    },
    onError: (_err, { athleteId }, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(QK.energyAssignments(athleteId), ctx.previous);
      }
      toast.error("Erreur lors de la mise à jour de l'assignation");
    },
    onSuccess: (_data, { athleteId }) => {
      qc.invalidateQueries({ queryKey: QK.energyAssignments(athleteId) });
      qc.invalidateQueries({ queryKey: ["cal", athleteId] });
      toast.success("Assignation mise à jour");
    },
  });
}

export function useUnassignEnergySession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, athleteId }: { id: string; athleteId: string }) => {
      const { error } = await supabase
        .from('energy_session_assignments')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { id, athleteId };
    },
    onMutate: async ({ id, athleteId }) => {
      const key = QK.energyAssignments(athleteId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<EnergySessionAssignmentRow[]>(key);
      qc.setQueryData<EnergySessionAssignmentRow[]>(key, (old = []) =>
        old.filter((a) => a.id !== id)
      );
      return { previous, athleteId };
    },
    onError: (_err, { athleteId }, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(QK.energyAssignments(athleteId), ctx.previous);
      }
      toast.error("Erreur lors de la suppression de l'assignation");
    },
    onSuccess: (_data, { athleteId }) => {
      qc.invalidateQueries({ queryKey: QK.energyAssignments(athleteId) });
      qc.invalidateQueries({ queryKey: ["cal", athleteId] });
      toast.success("Assignation supprimée");
    },
  });
}

/** Raccourci pour mettre à jour uniquement le statut d'une assignation. */
export function useUpdateAssignmentStatus() {
  const update = useUpdateEnergyAssignment();
  return {
    ...update,
    mutate: (args: { id: string; athleteId: string; status: AssignmentStatus }) =>
      update.mutate(args),
    mutateAsync: (args: { id: string; athleteId: string; status: AssignmentStatus }) =>
      update.mutateAsync(args),
  };
}
