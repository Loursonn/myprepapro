-- Migration E — Corrections RLS
-- Corrige les politiques trop permissives identifiées dans DB_AUDIT.md.
-- Principe : un coach ne voit que les données de SES propres athlètes.
-- Idempotente : DROP POLICY IF EXISTS avant chaque CREATE POLICY.
-- 2026-04-27

-- ── Helper : function pour vérifier coach → athlète ──────────────────────────
-- Réutilisée par plusieurs politiques pour éviter la duplication du sous-select.
CREATE OR REPLACE FUNCTION public.is_coach_of(athlete_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = athlete_uuid
      AND coach_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_coach_of(uuid) IS
  'Retourne true si auth.uid() est le coach de l''athlète donné.';

GRANT EXECUTE ON FUNCTION public.is_coach_of(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- energy_session_config — restricture la lecture coach à SES athlètes
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "energy_cfg_select" ON public.energy_session_config;
-- Athlète : ses propres configs
-- Coach : uniquement ses athlètes (via is_coach_of)
CREATE POLICY "energy_cfg_select" ON public.energy_session_config
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
  );

DROP POLICY IF EXISTS "energy_cfg_insert" ON public.energy_session_config;
-- Coach insère uniquement pour ses athlètes
CREATE POLICY "energy_cfg_insert" ON public.energy_session_config
  FOR INSERT WITH CHECK (
    public.is_coach_of(athlete_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "energy_cfg_update" ON public.energy_session_config;
CREATE POLICY "energy_cfg_update" ON public.energy_session_config
  FOR UPDATE USING (
    public.is_coach_of(athlete_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "energy_cfg_delete" ON public.energy_session_config;
CREATE POLICY "energy_cfg_delete" ON public.energy_session_config
  FOR DELETE USING (
    public.is_coach_of(athlete_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- energy_workout_logs — restricture la lecture coach à SES athlètes
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "energy_log_select" ON public.energy_workout_logs;
CREATE POLICY "energy_log_select" ON public.energy_workout_logs
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
  );
-- Les autres politiques energy_log (insert/update/delete) ne concernent que l'athlète — OK.

-- ────────────────────────────────────────────────────────────────────────────
-- habits — restricture la lecture coach à SES athlètes
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "habits_select" ON public.habits;
CREATE POLICY "habits_select" ON public.habits
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ────────────────────────────────────────────────────────────────────────────
-- habit_logs — restricture la lecture coach à SES athlètes
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "habit_logs_select" ON public.habit_logs;
CREATE POLICY "habit_logs_select" ON public.habit_logs
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ────────────────────────────────────────────────────────────────────────────
-- performance_logs — restricture la lecture coach à SES athlètes
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "perf_select" ON public.performance_logs;
CREATE POLICY "perf_select" ON public.performance_logs
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "perf_insert" ON public.performance_logs;
CREATE POLICY "perf_insert" ON public.performance_logs
  FOR INSERT WITH CHECK (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "perf_update" ON public.performance_logs;
CREATE POLICY "perf_update" ON public.performance_logs
  FOR UPDATE USING (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "perf_delete" ON public.performance_logs;
CREATE POLICY "perf_delete" ON public.performance_logs
  FOR DELETE USING (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ────────────────────────────────────────────────────────────────────────────
-- retours — restricture la lecture aux athlètes concernés et leur coach
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Lecture retours pour utilisateurs authentifiés" ON public.retours;
CREATE POLICY "retours_select" ON public.retours
  FOR SELECT USING (
    -- L'athlète auteur peut voir ses retours
    athlete_id = auth.uid()
    -- Le coach de cet athlète peut voir les retours
    OR public.is_coach_of(athlete_id)
    -- Admin voit tout
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ────────────────────────────────────────────────────────────────────────────
-- test_sessions — déjà OK (coach_id = auth.uid()), mais on s'assure que
-- le coach ne voit que ses propres sessions de test
-- ────────────────────────────────────────────────────────────────────────────
-- Politique existante : SELECT WHERE athlete_id=auth.uid() OR coach_id=auth.uid()
-- C'est déjà correct car le coach_id est défini à la création. Pas de changement.

-- ────────────────────────────────────────────────────────────────────────────
-- energy_exercises — publique en lecture (inchangé, exercices partagés)
-- ────────────────────────────────────────────────────────────────────────────
-- Pas de changement nécessaire.
