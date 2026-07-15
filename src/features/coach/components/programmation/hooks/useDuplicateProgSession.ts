import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/integrations/supabase/client"
import type { ProgSession } from "../types"

/** Clone profond avec nouveaux ids (séance, blocs, exercices) pour éviter
 *  toute collision avec les workout_logs / drag&drop de l'athlète source. */
function cloneSession(session: ProgSession): ProgSession {
  return {
    ...session,
    id: crypto.randomUUID(),
    blocs: session.blocs.map(b => ({
      ...b,
      id: crypto.randomUUID(),
      exercices: b.exercices.map(e => ({ ...e, id: crypto.randomUUID() })),
    })),
  }
}

export function useDuplicateProgSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ session, targetAthleteId }: { session: ProgSession; targetAthleteId: string }) => {
      const { data, error } = await supabase
        .from('app_data')
        .select('value')
        .eq('athlete_id', targetAthleteId)
        .eq('key', 'asp:prog')
        .maybeSingle()
      if (error) throw error

      const existing = (data?.value ?? []) as ProgSession[]
      const next = [...existing, cloneSession(session)]

      const { error: upsertError } = await supabase
        .from('app_data')
        .upsert({ athlete_id: targetAthleteId, key: 'asp:prog', value: next as unknown as Record<string, unknown>[] })
      if (upsertError) throw upsertError
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['asp-prog', vars.targetAthleteId] })
    },
    onError: () => toast.error("Erreur lors de la duplication"),
  })
}
