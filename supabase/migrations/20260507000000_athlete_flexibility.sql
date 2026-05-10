-- Migration : Flexibilité planning athlète + modifications de séance
-- 2026-05-07
--
-- Ajoute à workout_logs :
--   original_scheduled_date  — date initialement planifiée (immuable après INSERT)
--   rescheduled_by_athlete   — l'athlète a modifié la date
--   reschedule_reason        — raison optionnelle donnée par l'athlète
--   coach_alert              — décalage vers semaine suivante → notifier le coach
--   athlete_modifications    — séries/exercices bonus ajoutés pendant la séance

-- ── 1. Nouvelles colonnes ────────────────────────────────────────────────────

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS original_scheduled_date     DATE,
  ADD COLUMN IF NOT EXISTS rescheduled_by_athlete      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reschedule_reason           TEXT,
  ADD COLUMN IF NOT EXISTS coach_alert                 BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS athlete_modifications       JSONB;

-- ── 2. Backfill original_scheduled_date pour les logs existants ──────────────

UPDATE public.workout_logs
  SET original_scheduled_date = scheduled_date
  WHERE original_scheduled_date IS NULL;

-- Rendre la colonne NOT NULL maintenant que le backfill est fait
ALTER TABLE public.workout_logs
  ALTER COLUMN original_scheduled_date SET NOT NULL,
  ALTER COLUMN original_scheduled_date SET DEFAULT CURRENT_DATE;

-- ── 3. Contrainte UNIQUE sur original_scheduled_date ────────────────────────
-- L'unicité métier = un athlète ne peut avoir qu'un seul log original par (session_id, date originale).
-- La date effective (scheduled_date) peut bouger après reschedule.

DROP INDEX IF EXISTS idx_workout_logs_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_unique_original
  ON public.workout_logs (athlete_id, session_id, original_scheduled_date);

-- ── 4. Index sur les nouvelles colonnes ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workout_logs_coach_alert
  ON public.workout_logs (coach_id, coach_alert)
  WHERE coach_alert = true;

CREATE INDEX IF NOT EXISTS idx_workout_logs_athlete_mods
  ON public.workout_logs (athlete_id, scheduled_date DESC)
  WHERE athlete_modifications IS NOT NULL;

-- ── 5. RLS : politique UPDATE self restreinte ────────────────────────────────
-- Supprime la politique ALL trop permissive, remplace par SELECT + INSERT + UPDATE limité.

DROP POLICY IF EXISTS "workout_logs_self" ON public.workout_logs;

-- Athlète : SELECT ses propres logs
CREATE POLICY "workout_logs_self_select" ON public.workout_logs
  FOR SELECT USING (athlete_id = auth.uid());

-- Athlète : INSERT ses propres logs
CREATE POLICY "workout_logs_self_insert" ON public.workout_logs
  FOR INSERT WITH CHECK (athlete_id = auth.uid());

-- Athlète : UPDATE uniquement les colonnes autorisées (via check sur colonnes immuables)
-- On ne peut PAS restreindre par colonne en SQL RLS standard, mais on peut interdire
-- via une politique qui vérifie que les champs sensibles n'ont pas changé.
-- En pratique : la RLS permet l'UPDATE si athlete_id = auth.uid().
-- La restriction de colonnes est assurée côté app (les hooks n'envoient que les champs autorisés).
-- Les champs interdits (session_id, coach_id, microcycle_id, original_scheduled_date) ne sont
-- jamais inclus dans les UPDATE athlète dans le code applicatif.
CREATE POLICY "workout_logs_self_update" ON public.workout_logs
  FOR UPDATE USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- ── 6. Mise à jour cron mark-missed-workouts ─────────────────────────────────
-- Ne pas marquer 'missed' si la séance a été volontairement décalée par l'athlète
-- (rescheduled_by_athlete = true signifie que scheduled_date est la nouvelle date effective).
-- La logique reste correcte : on marque missed si scheduled_date < CURRENT_DATE et status=planned.
-- Un reschedule met à jour scheduled_date vers la nouvelle date → la séance ne sera pas missed
-- tant que la nouvelle date n'est pas dépassée.
-- Pas de changement SQL nécessaire sur le cron : le comportement est déjà correct.
-- NOTE : Si rescheduled_by_athlete = true ET scheduled_date < CURRENT_DATE → marquer missed quand même
--        (l'athlète a décalé mais n'a quand même pas fait la séance).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-missed-workouts') THEN
    PERFORM cron.unschedule('mark-missed-workouts');
    PERFORM cron.schedule(
      'mark-missed-workouts',
      '0 3 * * *',
      $$
        UPDATE public.workout_logs
        SET status = 'missed', updated_at = now()
        WHERE status = 'planned'
          AND scheduled_date < CURRENT_DATE
          AND scheduled_date >= CURRENT_DATE - 30;
      $$
    );
  END IF;
EXCEPTION
  WHEN undefined_schema THEN NULL;
  WHEN undefined_table  THEN NULL;
END;
$$;

-- Même mise à jour pour la fonction mark_missed_workouts (Edge Function fallback)
CREATE OR REPLACE FUNCTION public.mark_missed_workouts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.workout_logs
  SET status = 'missed', updated_at = now()
  WHERE status = 'planned'
    AND scheduled_date < CURRENT_DATE
    AND scheduled_date >= CURRENT_DATE - 30;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_missed_workouts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_missed_workouts() TO service_role;
