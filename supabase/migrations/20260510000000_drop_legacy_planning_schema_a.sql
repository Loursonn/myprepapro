-- ============================================================
-- Migration : Suppression Schéma A (seasons + planning_blocks)
-- On garde macrocycles/mesocycles/cycles/microcycles (Schéma B)
-- competitions.macrocycle_id déjà présent → on drop planning_block_id + season_id
-- 2026-05-10
-- ============================================================

-- 1. Supprimer les FK orphelines sur competitions
ALTER TABLE public.competitions
  DROP COLUMN IF EXISTS planning_block_id,
  DROP COLUMN IF EXISTS season_id;

-- 2. Supprimer la FK planning_block_id sur test_sessions
ALTER TABLE public.test_sessions
  DROP COLUMN IF EXISTS planning_block_id;

-- 3. DROP planning_blocks (CASCADE pour FK orphelines éventuelles)
DROP TABLE IF EXISTS public.planning_blocks CASCADE;

-- 4. DROP seasons (CASCADE)
DROP TABLE IF EXISTS public.seasons CASCADE;

NOTIFY pgrst, 'reload schema';
