/**
 * usePRLogs — CRUD pour exercise_pr_logs.
 *
 * source = 'manual'   → saisi par coach ou athlète
 * source = 'computed' → calculé via Epley (kg * (1 + reps/30)) à la fin d'une séance
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Epley 1RM ────────────────────────────────────────────────────────────────

/** Epley formula: kg × (1 + reps / 30). Rounded to 0.5kg. */
export function epley1RM(kg: number, reps: number): number {
  if (reps <= 0 || kg <= 0) return 0;
  if (reps === 1) return kg;
  return Math.round(kg * (1 + reps / 30) * 2) / 2;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PRLog {
  id: string;
  athlete_id: string;
  exercise_ref: string;
  kg: number;
  date: string;
  notes?: string;
  source: "manual" | "computed";
  source_reps?: number;
  source_kg?: number;
  created_at: string;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

const KEY = (athleteId: string) => ["pr-logs", athleteId] as const;

// ─── Fetch all PRs for an athlete ─────────────────────────────────────────────

export function usePRLogs(athleteId: string | undefined) {
  return useQuery({
    queryKey: KEY(athleteId ?? ""),
    enabled: !!athleteId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_pr_logs")
        .select("*")
        .eq("athlete_id", athleteId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as PRLog[];
    },
  });
}

// ─── PRs grouped by exercise_ref ──────────────────────────────────────────────

export function usePRsByRef(athleteId: string | undefined) {
  const { data: all, ...rest } = usePRLogs(athleteId);
  const byRef: Record<string, PRLog[]> = {};
  if (all) {
    for (const pr of all) {
      if (!byRef[pr.exercise_ref]) byRef[pr.exercise_ref] = [];
      byRef[pr.exercise_ref].push(pr);
    }
  }
  // Best PR per ref (highest kg)
  const bestByRef: Record<string, PRLog> = {};
  for (const [ref, prs] of Object.entries(byRef)) {
    bestByRef[ref] = prs.reduce((m, p) => p.kg > m.kg ? p : m, prs[0]);
  }
  return { byRef, bestByRef, ...rest };
}

// ─── Add PR (manual or computed) ─────────────────────────────────────────────

export interface AddPRPayload {
  athleteId: string;
  exercise_ref: string;
  kg: number;
  date: string;
  notes?: string;
  source?: "manual" | "computed";
  source_reps?: number;
  source_kg?: number;
}

export function useAddPRLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AddPRPayload) => {
      const { data, error } = await supabase
        .from("exercise_pr_logs")
        .insert({
          athlete_id:   payload.athleteId,
          exercise_ref: payload.exercise_ref,
          kg:           payload.kg,
          date:         payload.date,
          notes:        payload.notes ?? null,
          source:       payload.source ?? "manual",
          source_reps:  payload.source_reps ?? null,
          source_kg:    payload.source_kg ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as PRLog;
    },
    onSuccess: (_, payload) => {
      qc.invalidateQueries({ queryKey: KEY(payload.athleteId) });
      if (payload.source !== "computed") toast.success("Record enregistré");
    },
    onError: (err: Error) => {
      toast.error("Erreur : " + err.message);
    },
  });
}

// ─── Delete PR ────────────────────────────────────────────────────────────────

export function useDeletePRLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, athleteId }: { id: string; athleteId: string }) => {
      const { error } = await supabase
        .from("exercise_pr_logs")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { id, athleteId };
    },
    onSuccess: (_, { athleteId }) => {
      qc.invalidateQueries({ queryKey: KEY(athleteId) });
      toast.success("Record supprimé");
    },
    onError: (err: Error) => {
      toast.error("Erreur : " + err.message);
    },
  });
}
