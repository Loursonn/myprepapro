-- ============================================================
-- Migration : Périodisation — reset propre
-- Repartir à 0 : DROP CASCADE + recréation schéma net
-- workout_logs préservé (ajout FK optionnelle)
-- RLS simplifié : coach_id = auth.uid() partout
-- 2026-04-29
-- ============================================================

-- ── 1. NETTOYAGE ──────────────────────────────────────────────

-- Retirer FK workout_logs → microcycles avant DROP
ALTER TABLE public.workout_logs DROP COLUMN IF EXISTS microcycle_id;

DROP TABLE IF EXISTS public.microcycles  CASCADE;
DROP TABLE IF EXISTS public.cycles       CASCADE;
DROP TABLE IF EXISTS public.mesocycles   CASCADE;
DROP TABLE IF EXISTS public.macrocycles  CASCADE;
DROP TABLE IF EXISTS public.workout_rpe  CASCADE;

DROP FUNCTION IF EXISTS public.cycle_athlete_id(uuid);
DROP FUNCTION IF EXISTS public.cycle_coach_id(uuid);
DROP FUNCTION IF EXISTS public.check_mesocycle_dates();
DROP FUNCTION IF EXISTS public.check_cycle_dates();

-- ── 2. MACROCYCLES ────────────────────────────────────────────

CREATE TABLE public.macrocycles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name        TEXT        NOT NULL,
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  objective   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT macrocycles_dates CHECK (end_date > start_date)
);
CREATE INDEX idx_macrocycles_athlete ON public.macrocycles(athlete_id);
CREATE INDEX idx_macrocycles_coach   ON public.macrocycles(coach_id);
CREATE INDEX idx_macrocycles_dates   ON public.macrocycles(start_date, end_date);

-- ── 3. MESOCYCLES ─────────────────────────────────────────────

CREATE TABLE public.mesocycles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  macrocycle_id    UUID        NOT NULL REFERENCES public.macrocycles(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  start_date       DATE        NOT NULL,
  end_date         DATE        NOT NULL,
  objective        TEXT,
  volume_config    JSONB       DEFAULT '{"type":"progressive"}'::jsonb,
  intensity_config JSONB       DEFAULT '{"zones":[]}'::jsonb,
  frequency        SMALLINT    CHECK (frequency BETWEEN 1 AND 14),
  deload_week      SMALLINT    CHECK (deload_week >= 1),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mesocycles_dates CHECK (end_date > start_date)
);
CREATE INDEX idx_mesocycles_macro ON public.mesocycles(macrocycle_id);
CREATE INDEX idx_mesocycles_dates ON public.mesocycles(start_date, end_date);

-- ── 4. CYCLES ─────────────────────────────────────────────────

CREATE TABLE public.cycles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mesocycle_id UUID        NOT NULL REFERENCES public.mesocycles(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  start_date   DATE        NOT NULL,
  end_date     DATE        NOT NULL,
  objective    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cycles_dates CHECK (end_date > start_date)
);
CREATE INDEX idx_cycles_meso  ON public.cycles(mesocycle_id);
CREATE INDEX idx_cycles_dates ON public.cycles(start_date, end_date);

-- ── 5. MICROCYCLES ────────────────────────────────────────────

CREATE TABLE public.microcycles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id    UUID        NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  week_number SMALLINT    NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  is_deload   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT microcycles_dates CHECK (end_date > start_date)
);
CREATE INDEX idx_microcycles_cycle ON public.microcycles(cycle_id);
CREATE INDEX idx_microcycles_dates ON public.microcycles(start_date, end_date);

-- ── 6. WORKOUT_RPE ────────────────────────────────────────────

CREATE TABLE public.workout_rpe (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id UUID        NOT NULL REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  athlete_id     UUID        NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  rpe_score      SMALLINT    NOT NULL CHECK (rpe_score BETWEEN 1 AND 10),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workout_log_id)
);
CREATE INDEX idx_workout_rpe_athlete ON public.workout_rpe(athlete_id);

-- ── 7. WORKOUT_LOGS — FK microcycle optionnelle ───────────────

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

CREATE INDEX IF NOT EXISTS idx_workout_logs_micro ON public.workout_logs(microcycle_id);

-- ── 8. GRANTS ─────────────────────────────────────────────────

GRANT ALL ON public.macrocycles TO authenticated;
GRANT ALL ON public.mesocycles  TO authenticated;
GRANT ALL ON public.cycles      TO authenticated;
GRANT ALL ON public.microcycles TO authenticated;
GRANT ALL ON public.workout_rpe TO authenticated;

-- ── 9. HELPER FUNCTIONS ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cycle_athlete_id(p_cycle_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT ma.athlete_id
    FROM public.cycles cy
    JOIN public.mesocycles  me ON me.id = cy.mesocycle_id
    JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
   WHERE cy.id = p_cycle_id;
$$;
GRANT EXECUTE ON FUNCTION public.cycle_athlete_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cycle_coach_id(p_cycle_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT ma.coach_id
    FROM public.cycles cy
    JOIN public.mesocycles  me ON me.id = cy.mesocycle_id
    JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
   WHERE cy.id = p_cycle_id;
$$;
GRANT EXECUTE ON FUNCTION public.cycle_coach_id(uuid) TO authenticated;

-- ── 10. RLS — MACROCYCLES ─────────────────────────────────────
-- Règle simple : coach_id = auth.uid() pour écriture
-- Athlète lit ses propres macros ; coach lit ceux de ses athlètes

ALTER TABLE public.macrocycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "macrocycles_select" ON public.macrocycles;
DROP POLICY IF EXISTS "macrocycles_insert" ON public.macrocycles;
DROP POLICY IF EXISTS "macrocycles_update" ON public.macrocycles;
DROP POLICY IF EXISTS "macrocycles_delete" ON public.macrocycles;

CREATE POLICY "macrocycles_select" ON public.macrocycles FOR SELECT USING (
  athlete_id = auth.uid()
  OR coach_id  = auth.uid()
  OR public.is_coach_of(athlete_id)
);
CREATE POLICY "macrocycles_insert" ON public.macrocycles FOR INSERT WITH CHECK (
  coach_id = auth.uid()
);
CREATE POLICY "macrocycles_update" ON public.macrocycles FOR UPDATE USING (
  coach_id = auth.uid()
);
CREATE POLICY "macrocycles_delete" ON public.macrocycles FOR DELETE USING (
  coach_id = auth.uid()
);

-- ── 11. RLS — MESOCYCLES ──────────────────────────────────────

ALTER TABLE public.mesocycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mesocycles_select" ON public.mesocycles;
DROP POLICY IF EXISTS "mesocycles_insert" ON public.mesocycles;
DROP POLICY IF EXISTS "mesocycles_update" ON public.mesocycles;
DROP POLICY IF EXISTS "mesocycles_delete" ON public.mesocycles;

CREATE POLICY "mesocycles_select" ON public.mesocycles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.macrocycles m WHERE m.id = macrocycle_id
      AND (m.athlete_id = auth.uid() OR m.coach_id = auth.uid() OR public.is_coach_of(m.athlete_id))
  )
);
CREATE POLICY "mesocycles_insert" ON public.mesocycles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.macrocycles m WHERE m.id = macrocycle_id AND m.coach_id = auth.uid())
);
CREATE POLICY "mesocycles_update" ON public.mesocycles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.macrocycles m WHERE m.id = macrocycle_id AND m.coach_id = auth.uid())
);
CREATE POLICY "mesocycles_delete" ON public.mesocycles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.macrocycles m WHERE m.id = macrocycle_id AND m.coach_id = auth.uid())
);

-- ── 12. RLS — CYCLES ──────────────────────────────────────────

ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cycles_select" ON public.cycles;
DROP POLICY IF EXISTS "cycles_insert" ON public.cycles;
DROP POLICY IF EXISTS "cycles_update" ON public.cycles;
DROP POLICY IF EXISTS "cycles_delete" ON public.cycles;

CREATE POLICY "cycles_select" ON public.cycles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.mesocycles me
    JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
    WHERE me.id = mesocycle_id
      AND (ma.athlete_id = auth.uid() OR ma.coach_id = auth.uid() OR public.is_coach_of(ma.athlete_id))
  )
);
CREATE POLICY "cycles_insert" ON public.cycles FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.mesocycles me
    JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
    WHERE me.id = mesocycle_id AND ma.coach_id = auth.uid()
  )
);
CREATE POLICY "cycles_update" ON public.cycles FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.mesocycles me
    JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
    WHERE me.id = mesocycle_id AND ma.coach_id = auth.uid()
  )
);
CREATE POLICY "cycles_delete" ON public.cycles FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.mesocycles me
    JOIN public.macrocycles ma ON ma.id = me.macrocycle_id
    WHERE me.id = mesocycle_id AND ma.coach_id = auth.uid()
  )
);

-- ── 13. RLS — MICROCYCLES ─────────────────────────────────────

ALTER TABLE public.microcycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "microcycles_select" ON public.microcycles;
DROP POLICY IF EXISTS "microcycles_insert" ON public.microcycles;
DROP POLICY IF EXISTS "microcycles_update" ON public.microcycles;
DROP POLICY IF EXISTS "microcycles_delete" ON public.microcycles;

CREATE POLICY "microcycles_select" ON public.microcycles FOR SELECT USING (
  public.cycle_athlete_id(cycle_id) = auth.uid()
  OR public.cycle_coach_id(cycle_id)  = auth.uid()
  OR public.is_coach_of(public.cycle_athlete_id(cycle_id))
);
CREATE POLICY "microcycles_insert" ON public.microcycles FOR INSERT WITH CHECK (
  public.cycle_coach_id(cycle_id) = auth.uid()
);
CREATE POLICY "microcycles_update" ON public.microcycles FOR UPDATE USING (
  public.cycle_coach_id(cycle_id) = auth.uid()
);
CREATE POLICY "microcycles_delete" ON public.microcycles FOR DELETE USING (
  public.cycle_coach_id(cycle_id) = auth.uid()
);

-- ── 14. RLS — WORKOUT_RPE ─────────────────────────────────────

ALTER TABLE public.workout_rpe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workout_rpe_select" ON public.workout_rpe;
DROP POLICY IF EXISTS "workout_rpe_insert" ON public.workout_rpe;
DROP POLICY IF EXISTS "workout_rpe_update" ON public.workout_rpe;
DROP POLICY IF EXISTS "workout_rpe_delete" ON public.workout_rpe;

CREATE POLICY "workout_rpe_select" ON public.workout_rpe FOR SELECT USING (
  athlete_id = auth.uid() OR public.is_coach_of(athlete_id)
);
CREATE POLICY "workout_rpe_insert" ON public.workout_rpe FOR INSERT WITH CHECK (
  athlete_id = auth.uid()
);
CREATE POLICY "workout_rpe_update" ON public.workout_rpe FOR UPDATE USING (
  athlete_id = auth.uid()
);
CREATE POLICY "workout_rpe_delete" ON public.workout_rpe FOR DELETE USING (
  athlete_id = auth.uid()
);

NOTIFY pgrst, 'reload schema';
