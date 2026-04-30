-- ============================================================
-- Migration : Cycles standalone (sans mésocycle parent)
-- Permet de créer un cycle directement depuis un bloc app_data
-- sans nécessiter macrocycle → mésocycle → cycle
-- 2026-04-30
-- ============================================================

-- 1. Rendre mesocycle_id nullable
ALTER TABLE public.cycles
  ALTER COLUMN mesocycle_id DROP NOT NULL;

-- 2. Ajouter athlete_id et coach_id
ALTER TABLE public.cycles
  ADD COLUMN IF NOT EXISTS athlete_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS coach_id   UUID REFERENCES public.profiles(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_cycles_athlete ON public.cycles(athlete_id);

-- 3. Fonctions helper (gèrent NULL mesocycle_id)
CREATE OR REPLACE FUNCTION public.cycle_athlete_id(p_cycle_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT CASE
    WHEN cy.mesocycle_id IS NULL THEN cy.athlete_id
    ELSE ma.athlete_id
  END
  FROM public.cycles cy
  LEFT JOIN public.mesocycles  me ON me.id = cy.mesocycle_id
  LEFT JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
  WHERE cy.id = p_cycle_id;
$$;
GRANT EXECUTE ON FUNCTION public.cycle_athlete_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cycle_coach_id(p_cycle_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT CASE
    WHEN cy.mesocycle_id IS NULL THEN cy.coach_id
    ELSE ma.coach_id
  END
  FROM public.cycles cy
  LEFT JOIN public.mesocycles  me ON me.id = cy.mesocycle_id
  LEFT JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
  WHERE cy.id = p_cycle_id;
$$;
GRANT EXECUTE ON FUNCTION public.cycle_coach_id(uuid) TO authenticated;

-- 4. RLS désactivé pour usage mono-coach (à réactiver en multi-tenant)
DROP POLICY IF EXISTS "cycles_select" ON public.cycles;
DROP POLICY IF EXISTS "cycles_insert" ON public.cycles;
DROP POLICY IF EXISTS "cycles_update" ON public.cycles;
DROP POLICY IF EXISTS "cycles_delete" ON public.cycles;

ALTER TABLE public.cycles DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
