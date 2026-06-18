import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/integrations/supabase/client"
import type { Bloc } from "../types"

export function useUpdateProgrammation(athleteId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (blocs: Bloc[]) => {
      const { error } = await supabase
        .from('app_data')
        .upsert({ athlete_id: athleteId!, key: 'asp:blocs', value: blocs as unknown as Record<string, unknown>[] })
      if (error) throw error
      return blocs
    },
    onMutate: async (blocs) => {
      await qc.cancelQueries({ queryKey: ['asp-blocs', athleteId] })
      const prev = qc.getQueryData<Bloc[]>(['asp-blocs', athleteId])
      qc.setQueryData(['asp-blocs', athleteId], blocs)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(['asp-blocs', athleteId], ctx?.prev)
      toast.error('Erreur de sauvegarde')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['asp-blocs', athleteId] })
    }
  })
}
