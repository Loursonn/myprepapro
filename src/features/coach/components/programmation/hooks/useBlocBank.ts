import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/integrations/supabase/client"
import type { Bloc } from "../types"

// Banque de blocs préconstruits, scoped coach (clé app_data sur l'id du coach)
const KEY = 'asp:bloc-bank'

export function useBlocBank(coachId: string | undefined) {
  return useQuery<Bloc[]>({
    queryKey: ['asp-bloc-bank', coachId],
    enabled: !!coachId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_data')
        .select('value')
        .eq('athlete_id', coachId!)
        .eq('key', KEY)
        .maybeSingle()
      if (error) throw error
      return (data?.value ?? []) as Bloc[]
    }
  })
}

export function useUpdateBlocBank(coachId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (blocs: Bloc[]) => {
      const { error } = await supabase
        .from('app_data')
        .upsert({ athlete_id: coachId!, key: KEY, value: blocs as unknown as Record<string, unknown>[] })
      if (error) throw error
      return blocs
    },
    onMutate: async (blocs) => {
      await qc.cancelQueries({ queryKey: ['asp-bloc-bank', coachId] })
      const prev = qc.getQueryData<Bloc[]>(['asp-bloc-bank', coachId])
      qc.setQueryData(['asp-bloc-bank', coachId], blocs)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(['asp-bloc-bank', coachId], ctx?.prev)
      toast.error('Erreur de sauvegarde de la banque de blocs')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['asp-bloc-bank', coachId] })
    }
  })
}
