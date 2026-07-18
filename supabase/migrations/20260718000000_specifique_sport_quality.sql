-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : refonte Banque Spécifique — référentiels Sport / Qualité physique,
-- format WOD | Classique, banque de blocs spécifiques (privée coach)
-- 2026-07-18
--
-- 1. CREATE specific_sports        (référentiel seedé + custom coach)
-- 2. CREATE physical_qualities     (référentiel seedé + custom coach)
-- 3. ALTER  energy_sessions        (sport_id, quality_id, format, classique_structure)
--    + backfill quality_id depuis custom_kind pour les séances spécifiques
-- 4. CREATE specific_blocks        (banque de blocs, privée par coach)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. specific_sports ───────────────────────────────────────────────────────
-- coach_id NULL = sport global (seed), sinon custom du coach.

CREATE TABLE IF NOT EXISTS public.specific_sports (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        NOT NULL,
  icon       text,
  color      text,
  coach_id   uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_default boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unicité : un slug global unique, un slug unique par coach
CREATE UNIQUE INDEX IF NOT EXISTS uq_specific_sports_global_slug
  ON public.specific_sports (slug) WHERE coach_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_specific_sports_coach_slug
  ON public.specific_sports (coach_id, slug) WHERE coach_id IS NOT NULL;

ALTER TABLE public.specific_sports ENABLE ROW LEVEL SECURITY;

-- SELECT : défauts globaux + ses customs
CREATE POLICY "ss_select" ON public.specific_sports FOR SELECT
  TO authenticated
  USING (coach_id IS NULL OR coach_id = auth.uid());

-- INSERT : coach crée uniquement ses customs
CREATE POLICY "ss_insert" ON public.specific_sports FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('coach', 'coach_athlete')
    )
  );

-- UPDATE / DELETE : uniquement ses customs
CREATE POLICY "ss_update" ON public.specific_sports FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "ss_delete" ON public.specific_sports FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());

-- Seeds sports globaux
INSERT INTO public.specific_sports (name, slug, icon, color, coach_id, is_default) VALUES
  ('Hyrox',       'hyrox',     'Flame',     '#F5A623', NULL, true),
  ('Football',    'football',  'Trophy',    '#22C993', NULL, true),
  ('Rugby',       'rugby',     'Shield',    '#D4538E', NULL, true),
  ('Basket',      'basket',    'Dribbble',  '#F97316', NULL, true),
  ('Tennis',      'tennis',    'CircleDot', '#A3E635', NULL, true),
  ('Natation',    'natation',  'Waves',     '#3B8DF0', NULL, true),
  ('Course',      'course',    'Footprints','#7B6FFF', NULL, true),
  ('Cyclisme',    'cyclisme',  'Bike',      '#A855F7', NULL, true),
  ('CrossFit',    'crossfit',  'Dumbbell',  '#EF4444', NULL, true)
ON CONFLICT DO NOTHING;

-- ── 2. physical_qualities ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.physical_qualities (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        NOT NULL,
  coach_id   uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_default boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_physical_qualities_global_slug
  ON public.physical_qualities (slug) WHERE coach_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_physical_qualities_coach_slug
  ON public.physical_qualities (coach_id, slug) WHERE coach_id IS NOT NULL;

ALTER TABLE public.physical_qualities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pq_select" ON public.physical_qualities FOR SELECT
  TO authenticated
  USING (coach_id IS NULL OR coach_id = auth.uid());

CREATE POLICY "pq_insert" ON public.physical_qualities FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('coach', 'coach_athlete')
    )
  );

CREATE POLICY "pq_update" ON public.physical_qualities FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "pq_delete" ON public.physical_qualities FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());

-- Seeds qualités globales (inclut les anciennes catégories spécifiques pour backfill)
INSERT INTO public.physical_qualities (name, slug, coach_id, is_default) VALUES
  ('Vitesse',          'vitesse',        NULL, true),
  ('Endurance',        'endurance',      NULL, true),
  ('VO₂max / VMA',     'vo2max-vma',     NULL, true),
  ('Seuil lactique',   'seuil-lactique', NULL, true),
  ('Tempo',            'tempo',          NULL, true),
  ('Fartlek',          'fartlek',        NULL, true),
  ('Force',            'force',          NULL, true),
  ('Puissance',        'puissance',      NULL, true),
  ('Explosivité',      'explosivite',    NULL, true),
  ('Agilité',          'agilite',        NULL, true),
  ('Coordination',     'coordination',   NULL, true),
  ('Mobilité',         'mobilite',       NULL, true),
  ('Technique',        'technique',      NULL, true)
ON CONFLICT DO NOTHING;

-- ── 3. energy_sessions : sport / qualité / format ────────────────────────────

ALTER TABLE public.energy_sessions
  ADD COLUMN IF NOT EXISTS sport_id   uuid REFERENCES public.specific_sports(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quality_id uuid REFERENCES public.physical_qualities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS format     text NOT NULL DEFAULT 'wod',
  ADD COLUMN IF NOT EXISTS classique_structure jsonb;

-- format : 'wod' (builder intervalles) | 'classique' (builder par blocs)
-- 'classique' réservé aux séances spécifiques
ALTER TABLE public.energy_sessions
  DROP CONSTRAINT IF EXISTS energy_sessions_format_check;
ALTER TABLE public.energy_sessions
  ADD CONSTRAINT energy_sessions_format_check CHECK (
    format IN ('wod', 'classique')
    AND (format = 'wod' OR session_kind = 'specifique')
  );

CREATE INDEX IF NOT EXISTS idx_energy_sessions_sport_quality
  ON public.energy_sessions (sport_id, quality_id);

-- Backfill : catégorie spécifique legacy (custom_kind) → quality_id
UPDATE public.energy_sessions es
SET quality_id = pq.id
FROM public.physical_qualities pq
WHERE es.session_kind = 'specifique'
  AND es.quality_id IS NULL
  AND pq.coach_id IS NULL
  AND pq.slug = CASE es.custom_kind
    WHEN 'vo2'     THEN 'vo2max-vma'
    WHEN 'tempo'   THEN 'tempo'
    WHEN 'seuil'   THEN 'seuil-lactique'
    WHEN 'footing' THEN 'endurance'
    WHEN 'fartlek' THEN 'fartlek'
    ELSE NULL
  END;

-- ── 4. specific_blocks (banque privée par coach) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.specific_blocks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sport_id   uuid        REFERENCES public.specific_sports(id)    ON DELETE SET NULL,
  quality_id uuid        REFERENCES public.physical_qualities(id) ON DELETE SET NULL,
  content    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_specific_blocks_updated_at
  BEFORE UPDATE ON public.specific_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_specific_blocks_coach
  ON public.specific_blocks (coach_id);
CREATE INDEX IF NOT EXISTS idx_specific_blocks_sport_quality
  ON public.specific_blocks (sport_id, quality_id);

ALTER TABLE public.specific_blocks ENABLE ROW LEVEL SECURITY;

-- Banque privée : le coach ne voit et ne modifie que ses blocs
CREATE POLICY "sb_select" ON public.specific_blocks FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "sb_insert" ON public.specific_blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('coach', 'coach_athlete')
    )
  );

CREATE POLICY "sb_update" ON public.specific_blocks FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "sb_delete" ON public.specific_blocks FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());
