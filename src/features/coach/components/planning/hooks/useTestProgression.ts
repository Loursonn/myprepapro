import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, format } from "date-fns";
import { fr } from "date-fns/locale";

export interface TestProgressionPoint {
  date: string;      // "dd/MM"
  rawDate: string;   // "yyyy-MM-dd" for sorting
  value: number;
  testName: string;
}

export interface TestProgressionSeries {
  name: string;
  data: { date: string; value: number }[];
}

export function useTestProgression(macrocycleId: string) {
  return useQuery<TestProgressionSeries[]>({
    queryKey: ["test-progression", macrocycleId],
    enabled: !!macrocycleId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("test_results")
        .select("test_date, value, test:tests(name)")
        .eq("macrocycle_id", macrocycleId)
        .order("test_date");

      const byTest: Record<string, { date: string; value: number }[]> = {};
      for (const row of data ?? []) {
        const name = (row.test as { name: string } | null)?.name ?? "Test";
        const label = format(parseISO(row.test_date), "dd/MM", { locale: fr });
        (byTest[name] ??= []).push({ date: label, value: row.value });
      }

      return Object.entries(byTest).map(([name, data]) => ({ name, data }));
    },
  });
}
