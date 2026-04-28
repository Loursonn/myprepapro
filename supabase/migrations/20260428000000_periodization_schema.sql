-- ============================================================
-- Migration : Schéma de périodisation hiérarchique
-- Macro > Méso > Cycle > Micro + RPE + Tests library
-- 2026-04-28
--
-- Adaptations vs. demande initiale :
--   - profiles(id) au lieu d'athletes(id) [pas de table athletes]
--   - workout_logs au lieu de workouts
--   - competitions.priority déjà existant (TEXT) → on ajoute juste macrocycle_id
--   - is_coach_of() déjà défini → réutilisé pour RLS
--   - tests/test_results = banque de tests + mesures (≠ test_sessions existant)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. MACROCYCLES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.macrocycles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,                      -- ex: "Saison 2026"
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  objective   TEXT,                               -- ex: "Marathon sous 3:50"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT macrocycles_valid_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_macrocycles_athlete ON public.macrocycles(athlete_id);
CREATE INDEX IF NOT EXISTS idx_macrocycles_coach   ON public.macrocycles(coach_id);
CREATE INDEX IF NOT EXISTS idx_macrocycles_dates   ON public.macrocycles(start_date, end_date);

-- ──────────────────────────────────────────────────────────────
-- 2. MESOCYCLES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mesocycles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  macrocycle_id    UUID NOT NULL REFERENCES public.macrocycles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,                 -- ex: "Force Maximale"
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  objective        TEXT,                          -- ex: "Courir en 4:00/km"
  volume_config    JSONB,                         -- {type:"progressive", weeks:[70,80,90,100]}
  intensity_config JSONB,                         -- {zones:["Z2","Z3"], distribution:[60,40]}
  frequency        SMALLINT,                      -- séances/semaine
  deload_week      SMALLINT,                      -- numéro de semaine deload (ex: 4)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mesocycles_valid_dates CHECK (end_date > start_date),
  CONSTRAINT mesocycles_frequency   CHECK (frequency IS NULL OR frequency BETWEEN 1 AND 14),
  CONSTRAINT mesocycles_deload      CHECK (deload_week IS NULL OR deload_week >= 1)
);

CREATE INDEX IF NOT EXISTS idx_mesocycles_macro ON public.mesocycles(macrocycle_id);

-- ──────────────────────────────────────────────────────────────
-- 3. CYCLES (blocs de ~4 semaines)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cycles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mesocycle_id  UUID NOT NULL REFERENCES public.mesocycles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                    -- ex: "Cycle Janvier"
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cycles_valid_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_cycles_meso ON public.cycles(mesocycle_id);

-- ──────────────────────────────────────────────────────────────
-- 4. MICROCYCLES (semaines)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.microcycles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id     UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  week_number  SMALLINT NOT NULL,                 -- 1-52
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  is_deload    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT microcycles_valid_dates CHECK (end_date > start_date),
  CONSTRAINT microcycles_week_number CHECK (week_number BETWEEN 1 AND 53)
);

CREATE INDEX IF NOT EXISTS idx_microcycles_cycle ON public.microcycles(cycle_id);
CREATE INDEX IF NOT EXISTS idx_microcycles_dates ON public.microcycles(start_date, end_date);

-- ──────────────────────────────────────────────────────────────
-- 5. LIAISON workout_logs → microcycle (optionnelle, non destructive)
-- ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'workout_logs'
      AND column_name  = 'microcycle_id'
  ) THEN
    ALTER TABLE public.workout_logs
      ADD COLUMN microcycle_id UUID REFERENCES public.microcycles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workout_logs_microcycle
  ON public.workout_logs(microcycle_id)
  WHERE microcycle_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 6. LIAISON competitions → macrocycle (optionnelle)
-- priority TEXT existe déjà — on ajoute seulement macrocycle_id
-- ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'competitions'
      AND column_name  = 'macrocycle_id'
  ) THEN
    ALTER TABLE public.competitions
      ADD COLUMN macrocycle_id UUID REFERENCES public.macrocycles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_competitions_macro
  ON public.competitions(macrocycle_id)
  WHERE macrocycle_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 7. RPE — Rate of Perceived Exertion par workout_log
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_rpe (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  UUID NOT NULL REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  athlete_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rpe_score   SMALLINT NOT NULL CHECK (rpe_score BETWEEN 1 AND 10),
  comments    TEXT,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workout_id)  -- 1 RPE par workout
);

CREATE INDEX IF NOT EXISTS idx_rpe_athlete ON public.workout_rpe(athlete_id);
CREATE INDEX IF NOT EXISTS idx_rpe_logged  ON public.workout_rpe(logged_at DESC);

-- ──────────────────────────────────────────────────────────────
-- 8. BANQUE DE TESTS (définitions réutilisables)
-- Distinct de test_sessions (instances planifiées par coach)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,                       -- ex: "VMA", "1RM Squat"
  category   TEXT,                                -- "Cardio", "Force", "Puissance"
  unit       TEXT,                                -- "km/h", "kg", "s"
  higher_is_better BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.test_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id        UUID NOT NULL REFERENCES public.tests(id) ON DELETE RESTRICT,
  athlete_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  macrocycle_id  UUID REFERENCES public.macrocycles(id) ON DELETE SET NULL,
  -- Liaison optionnelle à test_sessions existant (pour les instances planifiées)
  test_session_id UUID REFERENCES public.test_sessions(id) ON DELETE SET NULL,
  value          NUMERIC NOT NULL,
  test_date      DATE NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_results_athlete ON public.test_results(athlete_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test    ON public.test_results(test_id, athlete_id);
CREATE INDEX IF NOT EXISTS idx_test_results_macro   ON public.test_results(macrocycle_id)
  WHERE macrocycle_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 9. TRIGGERS — validation dates dans la hiérarchie
-- ──────────────────────────────────────────────────────────────

-- Mésocycle : doit rester dans les bornes du macrocycle
CREATE OR REPLACE FUNCTION public.check_mesocycle_dates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  macro RECORD;
BEGIN
  SELECT start_date, end_date INTO macro
    FROM public.macrocycles WHERE id = NEW.macrocycle_id;
  IF NEW.start_date < macro.start_date OR NEW.end_date > macro.end_date THEN
    RAISE EXCEPTION
      'Mesocycle "%" (% → %) hors bornes macrocycle (% → %)',
      NEW.name, NEW.start_date, NEW.end_date, macro.start_date, macro.end_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_mesocycle_dates ON public.mesocycles;
CREATE TRIGGER validate_mesocycle_dates
  BEFORE INSERT OR UPDATE ON public.mesocycles
  FOR EACH ROW EXECUTE FUNCTION public.check_mesocycle_dates();

-- Cycle : doit rester dans les bornes du mésocycle
CREATE OR REPLACE FUNCTION public.check_cycle_dates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  meso RECORD;
BEGIN
  SELECT start_date, end_date INTO meso
    FROM public.mesocycles WHERE id = NEW.mesocycle_id;
  IF NEW.start_date < meso.start_date OR NEW.end_date > meso.end_date THEN
    RAISE EXCEPTION
      'Cycle "%" (% → %) hors bornes mésocycle (% → %)',
      NEW.name, NEW.start_date, NEW.end_date, meso.start_date, meso.end_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_cycle_dates ON public.cycles;
CREATE TRIGGER validate_cycle_dates
  BEFORE INSERT OR UPDATE ON public.cycles
  FOR EACH ROW EXECUTE FUNCTION public.check_cycle_dates();

-- Microcycle : doit rester dans les bornes du cycle
CREATE OR REPLACE FUNCTION public.check_microcycle_dates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cyc RECORD;
BEGIN
  SELECT start_date, end_date INTO cyc
    FROM public.cycles WHERE id = NEW.cycle_id;
  IF NEW.start_date < cyc.start_date OR NEW.end_date > cyc.end_date THEN
    RAISE EXCEPTION
      'Microcycle semaine % (% → %) hors bornes cycle (% → %)',
      NEW.week_number, NEW.start_date, NEW.end_date, cyc.start_date, cyc.end_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_microcycle_dates ON public.microcycles;
CREATE TRIGGER validate_microcycle_dates
  BEFORE INSERT OR UPDATE ON public.microcycles
  FOR EACH ROW EXECUTE FUNCTION public.check_microcycle_dates();

-- ──────────────────────────────────────────────────────────────
-- 10. RLS — activation
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.macrocycles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesocycles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microcycles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_rpe  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_results ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- 11. RLS — MACROCYCLES
-- Coach voit/gère ses athlètes ; athlète voit les siens
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "macrocycles_select"  ON public.macrocycles;
DROP POLICY IF EXISTS "macrocycles_insert"  ON public.macrocycles;
DROP POLICY IF EXISTS "macrocycles_update"  ON public.macrocycles;
DROP POLICY IF EXISTS "macrocycles_delete"  ON public.macrocycles;

CREATE POLICY "macrocycles_select" ON public.macrocycles FOR SELECT USING (
  athlete_id = auth.uid()
  OR public.is_coach_of(athlete_id)
);

CREATE POLICY "macrocycles_insert" ON public.macrocycles FOR INSERT WITH CHECK (
  public.is_coach_of(athlete_id)
  AND coach_id = auth.uid()
);

CREATE POLICY "macrocycles_update" ON public.macrocycles FOR UPDATE
  USING (public.is_coach_of(athlete_id))
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "macrocycles_delete" ON public.macrocycles FOR DELETE
  USING (public.is_coach_of(athlete_id));

-- ──────────────────────────────────────────────────────────────
-- 12. RLS — MESOCYCLES (via macrocycle → athlete)
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "mesocycles_select" ON public.mesocycles;
DROP POLICY IF EXISTS "mesocycles_insert" ON public.mesocycles;
DROP POLICY IF EXISTS "mesocycles_update" ON public.mesocycles;
DROP POLICY IF EXISTS "mesocycles_delete" ON public.mesocycles;

CREATE POLICY "mesocycles_select" ON public.mesocycles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.macrocycles m
    WHERE m.id = macrocycle_id
      AND (m.athlete_id = auth.uid() OR public.is_coach_of(m.athlete_id))
  )
);

CREATE POLICY "mesocycles_insert" ON public.mesocycles FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.macrocycles m
    WHERE m.id = macrocycle_id AND public.is_coach_of(m.athlete_id)
  )
);

CREATE POLICY "mesocycles_update" ON public.mesocycles FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.macrocycles m
    WHERE m.id = macrocycle_id AND public.is_coach_of(m.athlete_id)
  )
);

CREATE POLICY "mesocycles_delete" ON public.mesocycles FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.macrocycles m
    WHERE m.id = macrocycle_id AND public.is_coach_of(m.athlete_id)
  )
);

-- ──────────────────────────────────────────────────────────────
-- 13. RLS — CYCLES (via mesocycle → macrocycle → athlete)
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cycles_select" ON public.cycles;
DROP POLICY IF EXISTS "cycles_insert" ON public.cycles;
DROP POLICY IF EXISTS "cycles_update" ON public.cycles;
DROP POLICY IF EXISTS "cycles_delete" ON public.cycles;

CREATE POLICY "cycles_select" ON public.cycles FOR SELECT USING (
  EXISTS (
    SELECT 1
      FROM public.mesocycles me
      JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
     WHERE me.id = mesocycle_id
       AND (ma.athlete_id = auth.uid() OR public.is_coach_of(ma.athlete_id))
  )
);

CREATE POLICY "cycles_insert" ON public.cycles FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
      FROM public.mesocycles me
      JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
     WHERE me.id = mesocycle_id AND public.is_coach_of(ma.athlete_id)
  )
);

CREATE POLICY "cycles_update" ON public.cycles FOR UPDATE USING (
  EXISTS (
    SELECT 1
      FROM public.mesocycles me
      JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
     WHERE me.id = mesocycle_id AND public.is_coach_of(ma.athlete_id)
  )
);

CREATE POLICY "cycles_delete" ON public.cycles FOR DELETE USING (
  EXISTS (
    SELECT 1
      FROM public.mesocycles me
      JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
     WHERE me.id = mesocycle_id AND public.is_coach_of(ma.athlete_id)
  )
);

-- ──────────────────────────────────────────────────────────────
-- 14. RLS — MICROCYCLES (via cycle → mesocycle → macrocycle → athlete)
-- Sécurisé via CTE pour lisibilité + perf
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "microcycles_select" ON public.microcycles;
DROP POLICY IF EXISTS "microcycles_insert" ON public.microcycles;
DROP POLICY IF EXISTS "microcycles_update" ON public.microcycles;
DROP POLICY IF EXISTS "microcycles_delete" ON public.microcycles;

-- Helper : retourne l'athlete_id du macrocycle owning un cycle donné
CREATE OR REPLACE FUNCTION public.cycle_athlete_id(p_cycle_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public AS $$
  SELECT ma.athlete_id
    FROM public.cycles cy
    JOIN public.mesocycles me ON me.id = cy.mesocycle_id
    JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
   WHERE cy.id = p_cycle_id;
$$;
GRANT EXECUTE ON FUNCTION public.cycle_athlete_id(uuid) TO authenticated;

CREATE POLICY "microcycles_select" ON public.microcycles FOR SELECT USING (
  public.cycle_athlete_id(cycle_id) = auth.uid()
  OR public.is_coach_of(public.cycle_athlete_id(cycle_id))
);

CREATE POLICY "microcycles_insert" ON public.microcycles FOR INSERT WITH CHECK (
  public.is_coach_of(public.cycle_athlete_id(cycle_id))
);

CREATE POLICY "microcycles_update" ON public.microcycles FOR UPDATE USING (
  public.is_coach_of(public.cycle_athlete_id(cycle_id))
);

CREATE POLICY "microcycles_delete" ON public.microcycles FOR DELETE USING (
  public.is_coach_of(public.cycle_athlete_id(cycle_id))
);

-- ──────────────────────────────────────────────────────────────
-- 15. RLS — WORKOUT_RPE
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "workout_rpe_select" ON public.workout_rpe;
DROP POLICY IF EXISTS "workout_rpe_insert" ON public.workout_rpe;
DROP POLICY IF EXISTS "workout_rpe_update" ON public.workout_rpe;
DROP POLICY IF EXISTS "workout_rpe_delete" ON public.workout_rpe;

CREATE POLICY "workout_rpe_select" ON public.workout_rpe FOR SELECT USING (
  athlete_id = auth.uid()
  OR public.is_coach_of(athlete_id)
);

-- Seul l'athlète crée son RPE
CREATE POLICY "workout_rpe_insert" ON public.workout_rpe FOR INSERT WITH CHECK (
  athlete_id = auth.uid()
);

CREATE POLICY "workout_rpe_update" ON public.workout_rpe FOR UPDATE USING (
  athlete_id = auth.uid()
);

CREATE POLICY "workout_rpe_delete" ON public.workout_rpe FOR DELETE USING (
  athlete_id = auth.uid()
);

-- ──────────────────────────────────────────────────────────────
-- 16. RLS — TESTS (banque — lecture publique, écriture coach/admin)
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tests_select" ON public.tests;
DROP POLICY IF EXISTS "tests_insert" ON public.tests;
DROP POLICY IF EXISTS "tests_update" ON public.tests;
DROP POLICY IF EXISTS "tests_delete"  ON public.tests;

-- Tous les utilisateurs authentifiés voient la banque
CREATE POLICY "tests_select" ON public.tests FOR SELECT USING (auth.uid() IS NOT NULL);

-- Coach crée ses propres tests (ou admin)
CREATE POLICY "tests_insert" ON public.tests FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('coach', 'coach_athlete')
  )
);

CREATE POLICY "tests_update" ON public.tests FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "tests_delete" ON public.tests FOR DELETE USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ──────────────────────────────────────────────────────────────
-- 17. RLS — TEST_RESULTS
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "test_results_select" ON public.test_results;
DROP POLICY IF EXISTS "test_results_insert" ON public.test_results;
DROP POLICY IF EXISTS "test_results_update" ON public.test_results;
DROP POLICY IF EXISTS "test_results_delete" ON public.test_results;

CREATE POLICY "test_results_select" ON public.test_results FOR SELECT USING (
  athlete_id = auth.uid()
  OR public.is_coach_of(athlete_id)
);

-- Coach insert pour ses athlètes ; athlète insert pour lui-même
CREATE POLICY "test_results_insert" ON public.test_results FOR INSERT WITH CHECK (
  athlete_id = auth.uid()
  OR public.is_coach_of(athlete_id)
);

CREATE POLICY "test_results_update" ON public.test_results FOR UPDATE USING (
  athlete_id = auth.uid()
  OR public.is_coach_of(athlete_id)
);

CREATE POLICY "test_results_delete" ON public.test_results FOR DELETE USING (
  athlete_id = auth.uid()
  OR public.is_coach_of(athlete_id)
);

-- ──────────────────────────────────────────────────────────────
-- 18. MIGRATION DONNÉES EXISTANTES
-- competition sans priority → 'B' par défaut (déjà TEXT)
-- ──────────────────────────────────────────────────────────────
UPDATE public.competitions SET priority = 'B' WHERE priority IS NULL OR priority = '';

-- ──────────────────────────────────────────────────────────────
-- 19. FONCTION UTILITAIRE : trouver le microcycle d'une date
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.microcycle_for_athlete_date(
  p_athlete_id uuid,
  p_date       date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  microcycle_id   uuid,
  week_number     smallint,
  is_deload       boolean,
  cycle_name      text,
  mesocycle_name  text,
  macrocycle_name text
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public AS $$
  SELECT
    mi.id,
    mi.week_number,
    mi.is_deload,
    cy.name,
    me.name,
    ma.name
  FROM public.microcycles mi
  JOIN public.cycles    cy ON cy.id = mi.cycle_id
  JOIN public.mesocycles me ON me.id = cy.mesocycle_id
  JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
  WHERE ma.athlete_id = p_athlete_id
    AND p_date BETWEEN mi.start_date AND mi.end_date
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.microcycle_for_athlete_date(uuid, date) TO authenticated;

COMMENT ON FUNCTION public.microcycle_for_athlete_date IS
  'Retourne le microcycle actif pour un athlète à une date donnée (défaut: aujourd''hui).';
