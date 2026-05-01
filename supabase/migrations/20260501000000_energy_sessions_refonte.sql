-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : refonte module énergie
-- 2026-05-01
--
-- 1. DROP des anciennes tables énergie (CASCADE → policies/FK supprimées)
-- 2. is_certified_coach déjà existant sur profiles (idempotent)
-- 3. CREATE TABLE energy_sessions   (banque partagée + vérification certifiée)
-- 4. CREATE TABLE energy_session_assignments  (planning par athlète)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. DROP legacy tables ────────────────────────────────────────────────────

-- Policies, triggers et FKs enfants supprimés automatiquement via CASCADE
DROP TABLE IF EXISTS public.energy_session_config CASCADE;
DROP TABLE IF EXISTS public.energy_workout_logs    CASCADE;
DROP TABLE IF EXISTS public.energy_exercises       CASCADE;

-- Suppression des entrées app_data liées au planning énergie legacy (JSONB)
DELETE FROM public.app_data WHERE key IN ('asp:energy_week_plan', 'asp:energy_day_plan');

-- ── 2. profiles.is_certified_coach (déjà créé en 20260430200000) ─────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_certified_coach boolean NOT NULL DEFAULT false;

-- Protection : le trigger trg_prevent_flag_update (20260430200000_certified_coach.sql)
-- bloque toute modification de is_certified_coach et is_admin par des non-admins.
-- Pas de policy RLS supplémentaire nécessaire : le trigger couvre tous les chemins.

-- ── 3. CREATE TABLE energy_sessions ─────────────────────────────────────────
-- Banque de séances partagée. Toute session créée par un coach est disponible
-- en lecture à tous. Une session can be "vérifiée" par un coach certifié ou admin.

CREATE TABLE IF NOT EXISTS public.energy_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  session_kind     text        NOT NULL,
  custom_kind      text,
  structure_type   text        NOT NULL,
  intervals        jsonb       NOT NULL DEFAULT '[]',
  total_duration_s integer,
  total_distance_m integer,
  notes            text,
  created_by       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_verified      boolean     NOT NULL DEFAULT false,
  verified_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- session_kind : valeurs prédéfinies + 'custom' (requiert custom_kind)
  CONSTRAINT energy_sessions_kind_check CHECK (
    session_kind IN ('vo2', 'tempo', 'seuil', 'footing', 'fartlek', 'autre', 'custom')
  ),
  CONSTRAINT energy_sessions_custom_kind_check CHECK (
    session_kind <> 'custom' OR custom_kind IS NOT NULL
  ),
  -- structure_type : continu ou fractionné
  CONSTRAINT energy_sessions_structure_check CHECK (
    structure_type IN ('continu', 'fractionne')
  )
);

-- updated_at auto-refresh (fonction set_updated_at déjà présente en DB)
CREATE TRIGGER trg_energy_sessions_updated_at
  BEFORE UPDATE ON public.energy_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_energy_sessions_created_by
  ON public.energy_sessions (created_by);
CREATE INDEX IF NOT EXISTS idx_energy_sessions_kind
  ON public.energy_sessions (session_kind);
CREATE INDEX IF NOT EXISTS idx_energy_sessions_verified
  ON public.energy_sessions (is_verified);

ALTER TABLE public.energy_sessions ENABLE ROW LEVEL SECURITY;

-- SELECT : tout utilisateur authentifié (banque partagée)
CREATE POLICY "es_select"
  ON public.energy_sessions FOR SELECT
  TO authenticated
  USING (true);

-- INSERT : coach ou coach_athlete uniquement ; is_verified forcé à false
CREATE POLICY "es_insert"
  ON public.energy_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('coach', 'coach_athlete')
    )
    AND is_verified = false
  );

-- UPDATE (auteur) : auteur peut modifier ses propres sessions non-vérifiées
-- Ne peut PAS set is_verified=true (WITH CHECK impose false)
CREATE POLICY "es_update_author"
  ON public.energy_sessions FOR UPDATE
  TO authenticated
  USING  (created_by = auth.uid() AND is_verified = false)
  WITH CHECK (created_by = auth.uid() AND is_verified = false);

-- UPDATE (certifié) : coach certifié ou admin peut modifier n'importe quelle session
-- Y compris set is_verified=true ; aucune restriction sur WITH CHECK côté valeur
CREATE POLICY "es_update_certify"
  ON public.energy_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_certified_coach = true OR profiles.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.is_certified_coach = true OR profiles.is_admin = true)
    )
  );

-- DELETE : auteur (non-vérifiée seulement) ou admin
CREATE POLICY "es_delete"
  ON public.energy_sessions FOR DELETE
  TO authenticated
  USING (
    (created_by = auth.uid() AND is_verified = false)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- ── 4. CREATE TABLE energy_session_assignments ────────────────────────────────
-- Association d'une session à un athlète pour une date donnée.
-- Liée au microcycle si planifiée depuis le module planning.

CREATE TABLE IF NOT EXISTS public.energy_session_assignments (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id            uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  energy_session_id   uuid        NOT NULL REFERENCES public.energy_sessions(id) ON DELETE RESTRICT,
  scheduled_date      date        NOT NULL,
  status              text        NOT NULL DEFAULT 'planned',
  microcycle_id       uuid        REFERENCES public.microcycles(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT esa_status_check CHECK (
    status IN ('planned', 'in_progress', 'completed', 'missed', 'skipped')
  )
);

CREATE TRIGGER trg_energy_assignments_updated_at
  BEFORE UPDATE ON public.energy_session_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_esa_athlete_date
  ON public.energy_session_assignments (athlete_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_esa_session
  ON public.energy_session_assignments (energy_session_id);
CREATE INDEX IF NOT EXISTS idx_esa_microcycle
  ON public.energy_session_assignments (microcycle_id)
  WHERE microcycle_id IS NOT NULL;

ALTER TABLE public.energy_session_assignments ENABLE ROW LEVEL SECURITY;

-- SELECT : soi-même, coach de l'athlète, admin
CREATE POLICY "esa_select"
  ON public.energy_session_assignments FOR SELECT
  TO authenticated
  USING (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- INSERT : coach de l'athlète, admin, ou coach_athlete qui s'assigne lui-même
CREATE POLICY "esa_insert"
  ON public.energy_session_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- UPDATE : même périmètre que SELECT (athlète peut changer son statut)
CREATE POLICY "esa_update"
  ON public.energy_session_assignments FOR UPDATE
  TO authenticated
  USING (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- DELETE : coach de l'athlète ou admin (pas l'athlète lui-même)
CREATE POLICY "esa_delete"
  ON public.energy_session_assignments FOR DELETE
  TO authenticated
  USING (
    public.is_coach_of(athlete_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
