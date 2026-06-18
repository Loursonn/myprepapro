import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import type { Bloc } from "../types"

export function useProgrammation(athleteId: string | undefined) {
  return useQuery<Bloc[]>({
    queryKey: ['asp-blocs', athleteId],
    enabled: !!athleteId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_data')
        .select('value')
        .eq('athlete_id', athleteId!)
        .eq('key', 'asp:blocs')
        .maybeSingle()
      if (error) throw error
      return (data?.value ?? []) as Bloc[]
    }
  })
}
