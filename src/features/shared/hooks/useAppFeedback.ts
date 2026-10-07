/**
 * useAppFeedback — retours des athlètes sur l'application (table app_feedback).
 * Athlète : envoie un bug / une idée. Coach certifié / admin : liste + statut.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";

// Table absente des types générés → client non typé
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type AppFeedbackKind   = "bug" | "idea" | "other";
export type AppFeedbackStatus = "new" | "in_progress" | "done";

export interface AppFeedbackRow {
  id: string;
  author_id: string;
  kind: AppFeedbackKind;
  content: string;
  page: string | null;
  user_agent: string | null;
  status: AppFeedbackStatus;
  created_at: string;
  author?: { full_name: string | null; first_name: string | null; last_name: string | null } | null;
}

export const FEEDBACK_KIND_LABEL: Record<AppFeedbackKind, string> = { bug: "Bug", idea: "Idée", other: "Autre" };
export const FEEDBACK_STATUS_LABEL: Record<AppFeedbackStatus, string> = { new: "Nouveau", in_progress: "En cours", done: "Fait" };

export function useAppFeedbackList() {
  return useQuery({
    queryKey: QK.appFeedbackList,
    staleTime: 30_000,
    queryFn: async (): Promise<AppFeedbackRow[]> => {
      const { data, error } = await db
        .from("app_feedback")
        .select("*, author:profiles!app_feedback_author_id_fkey(full_name, first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSendAppFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { authorId: string; kind: AppFeedbackKind; content: string; page?: string }) => {
      const { error } = await db.from("app_feedback").insert({
        author_id:  input.authorId,
        kind:       input.kind,
        content:    input.content,
        page:       input.page ?? null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.appFeedbackList }),
  });
}

export function useUpdateAppFeedbackStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppFeedbackStatus }) => {
      const { error } = await db.from("app_feedback").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.appFeedbackList }),
  });
}

export function useDeleteAppFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("app_feedback").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.appFeedbackList }),
  });
}
