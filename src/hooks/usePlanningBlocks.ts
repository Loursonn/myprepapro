import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  Season,
  SeasonInsert,
  PlanningBlock,
  PlanningBlockInsert,
} from '@/types/planning';

// Cast to bypass auto-generated type restrictions for new tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── Seasons ────────────────────────────────────────────────────────────────

export function useSeasons(athleteId: string) {
  return useQuery<Season[]>({
    queryKey: ['seasons', athleteId],
    queryFn: async () => {
      const { data, error } = await db
        .from('seasons')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Season[];
    },
    enabled: !!athleteId,
  });
}

export function useCreateSeason() {
  const qc = useQueryClient();
  return useMutation<Season, Error, SeasonInsert>({
    mutationFn: async (season) => {
      const { data, error } = await db
        .from('seasons')
        .insert(season)
        .select()
        .single();
      if (error) throw error;
      return data as Season;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['seasons', data.athlete_id] });
    },
  });
}

export function useUpdateSeason() {
  const qc = useQueryClient();
  return useMutation<Season, Error, { id: string; updates: Partial<Season> }>({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await db
        .from('seasons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Season;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['seasons', data.athlete_id] });
    },
  });
}

export function useDeleteSeason() {
  const qc = useQueryClient();
  return useMutation<string, Error, { id: string; athlete_id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await db.from('seasons').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ['seasons', vars.athlete_id] });
      qc.removeQueries({ queryKey: ['planning_blocks'] });
    },
  });
}

// ── Planning blocks ─────────────────────────────────────────────────────────

export function usePlanningBlocks(seasonId: string | null) {
  return useQuery<PlanningBlock[]>({
    queryKey: ['planning_blocks', seasonId],
    queryFn: async () => {
      const { data, error } = await db
        .from('planning_blocks')
        .select('*')
        .eq('season_id', seasonId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlanningBlock[];
    },
    enabled: !!seasonId,
  });
}

export function useCreateBlock() {
  const qc = useQueryClient();
  return useMutation<PlanningBlock, Error, PlanningBlockInsert>({
    mutationFn: async (block) => {
      const { data, error } = await db
        .from('planning_blocks')
        .insert(block)
        .select()
        .single();
      if (error) throw error;
      return data as PlanningBlock;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['planning_blocks', data.season_id] });
    },
  });
}

export function useUpdateBlock() {
  const qc = useQueryClient();
  return useMutation<PlanningBlock, Error, { id: string; updates: Partial<PlanningBlock> }>({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await db
        .from('planning_blocks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as PlanningBlock;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['planning_blocks', data.season_id] });
    },
  });
}

export function useDeleteBlock() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; season_id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await db.from('planning_blocks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['planning_blocks', vars.season_id] });
    },
  });
}

// ── Tree builder ────────────────────────────────────────────────────────────

/** Convert a flat array of blocks into a nested tree (in-place children arrays). */
export function buildBlockTree(blocks: PlanningBlock[]): PlanningBlock[] {
  const map = new Map<string, PlanningBlock>();
  const roots: PlanningBlock[] = [];

  blocks.forEach((b) => {
    map.set(b.id, { ...b, children: [] });
  });

  map.forEach((b) => {
    if (b.parent_block_id && map.has(b.parent_block_id)) {
      map.get(b.parent_block_id)!.children!.push(b);
    } else {
      roots.push(b);
    }
  });

  return roots;
}

/** Get the depth of a block in the tree (0 = root). */
export function getBlockDepth(blockId: string, blocks: PlanningBlock[]): number {
  const block = blocks.find((b) => b.id === blockId);
  if (!block || !block.parent_block_id) return 0;
  return 1 + getBlockDepth(block.parent_block_id, blocks);
}
