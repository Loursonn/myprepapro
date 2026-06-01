import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TestCategory } from '@/features/shared/types/tests';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface CatSeriesPoint { date: string; value: number }
export interface CatSeries {
  testId: string;
  testName: string;
  varId: string;
  varKey: string;
  varLabel: string;
  unit: string;
  betterHigher: boolean;
  extrapMetric: string | null;
  extrapOp: 'div' | 'mul' | null;
  extrapFactor: number | null;
  points: CatSeriesPoint[]; // asc par date
}

interface VarMeta {
  id: string; key: string; label: string; unit: string; better_when: string;
  extrap_metric: string | null; extrap_op: 'div' | 'mul' | null; extrap_factor: number | null;
}

/** Séries de résultats (par test + variable) pour une catégorie, ordre chronologique. */
export function useCategoryTestSeries(athleteId: string, category: TestCategory) {
  return useQuery({
    queryKey: ['categoryTestSeries', athleteId, category],
    queryFn: async (): Promise<CatSeries[]> => {
      const { data: defs, error: dErr } = await db
        .from('test_definitions')
        .select('id, name, test_variables(id, key, label, unit, better_when, extrap_metric, extrap_op, extrap_factor)')
        .eq('category', category);
      if (dErr) throw dErr;
      const defList = (defs ?? []) as { id: string; name: string; test_variables: VarMeta[] }[];
      if (defList.length === 0) return [];

      const defById = new Map(defList.map(d => [d.id, d]));
      const varById = new Map<string, VarMeta>();
      for (const d of defList) for (const v of d.test_variables) varById.set(v.id, v);

      const { data: results, error: rErr } = await db
        .from('athlete_test_results')
        .select('test_definition_id, performed_at, athlete_test_values(value, variable_id)')
        .eq('athlete_id', athleteId)
        .in('test_definition_id', defList.map(d => d.id))
        .order('performed_at', { ascending: false });
      if (rErr) throw rErr;

      const map = new Map<string, CatSeries>();
      for (const r of (results ?? []) as { test_definition_id: string; performed_at: string; athlete_test_values: { value: number; variable_id: string }[] }[]) {
        const def = defById.get(r.test_definition_id);
        for (const v of r.athlete_test_values ?? []) {
          const meta = varById.get(v.variable_id);
          if (!meta) continue;
          const key = `${r.test_definition_id}:${v.variable_id}`;
          let s = map.get(key);
          if (!s) {
            s = {
              testId: r.test_definition_id, testName: def?.name ?? '',
              varId: v.variable_id, varKey: meta.key, varLabel: meta.label, unit: meta.unit,
              betterHigher: meta.better_when === 'higher',
              extrapMetric: meta.extrap_metric, extrapOp: meta.extrap_op, extrapFactor: meta.extrap_factor,
              points: [],
            };
            map.set(key, s);
          }
          s.points.push({ date: r.performed_at, value: Number(v.value) });
        }
      }
      for (const s of map.values()) s.points.sort((a, b) => a.date.localeCompare(b.date));
      return [...map.values()];
    },
    enabled: !!athleteId,
    staleTime: 30_000,
  });
}
