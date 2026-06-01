import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QK } from '@/lib/queryKeys';
import { ARTICULATIONS } from '@/features/shared/types/tests';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface ScorePoint { date: string; score: number | null }
export interface ArticularAction {
  testId: string;
  action: string;          // nom de l'action (sans le préfixe articulation)
  score: number | null;    // dernière note /5
  date: string | null;
  mediaUrl: string | null;
  history: ScorePoint[];   // toutes les saisies, plus récent en premier
}
export interface ArticularGroup {
  articulation: string;
  items: ArticularAction[];
}

function stripJoint(name: string, joint: string): string {
  const prefix = `${joint} — `;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

export function useArticularProfile(athleteId: string) {
  return useQuery({
    queryKey: QK.articularProfile(athleteId),
    queryFn: async (): Promise<ArticularGroup[]> => {
      // 1. Définitions articulaires (avec articulation renseignée)
      const { data: defs, error: defErr } = await db
        .from('test_definitions')
        .select('id, name, articulation, media_url')
        .eq('category', 'bilan_articulaire')
        .not('articulation', 'is', null);
      if (defErr) throw defErr;
      const defList = (defs ?? []) as { id: string; name: string; articulation: string; media_url: string | null }[];
      if (defList.length === 0) return [];

      // 2. Derniers résultats de l'athlète pour ces tests
      const { data: results, error: rErr } = await db
        .from('athlete_test_results')
        .select('test_definition_id, performed_at, athlete_test_values(value)')
        .eq('athlete_id', athleteId)
        .in('test_definition_id', defList.map(d => d.id))
        .order('performed_at', { ascending: false });
      if (rErr) throw rErr;

      // Historique par test (ordre desc → plus récent en premier)
      const history: Record<string, ScorePoint[]> = {};
      for (const r of (results ?? []) as { test_definition_id: string; performed_at: string; athlete_test_values: { value: number }[] }[]) {
        (history[r.test_definition_id] ??= []).push({ date: r.performed_at, score: r.athlete_test_values?.[0]?.value ?? null });
      }

      // 3. Regroupement par articulation
      const groups = new Map<string, ArticularAction[]>();
      for (const d of defList) {
        const hist = history[d.id] ?? [];
        const item: ArticularAction = {
          testId: d.id,
          action: stripJoint(d.name, d.articulation),
          score: hist[0]?.score ?? null,
          date: hist[0]?.date ?? null,
          mediaUrl: d.media_url,
          history: hist,
        };
        if (!groups.has(d.articulation)) groups.set(d.articulation, []);
        groups.get(d.articulation)!.push(item);
      }

      // Tri : articulations connues d'abord (ordre prédéfini), puis le reste alpha
      const order = (a: string) => {
        const i = (ARTICULATIONS as readonly string[]).indexOf(a);
        return i === -1 ? 99 : i;
      };
      return [...groups.entries()]
        .map(([articulation, items]) => ({ articulation, items: items.sort((x, y) => x.action.localeCompare(y.action)) }))
        .sort((a, b) => order(a.articulation) - order(b.articulation) || a.articulation.localeCompare(b.articulation));
    },
    enabled: !!athleteId,
    staleTime: 30_000,
  });
}
