-- Auto-clôture des séances travaillées mais jamais terminées
-- 2026-08-07
--
-- Problème : une séance dont l'athlète a saisi les charges/reps mais sans avoir
-- cliqué "Terminer la séance" reste en status='planned'. Le cron
-- mark-missed-workouts la passait alors en 'missed' — une séance réellement
-- effectuée était comptée comme non réalisée, et disparaissait des stats.
--
-- Nouvelle règle, appliquée dans cet ordre :
--   1. séance passée AVEC saisies  → 'completed'  (elle a bien été faite)
--   2. séance passée SANS saisies  → 'missed'     (comportement inchangé)
--
-- Le RPE de fin et le ressenti restent vides : ils ne peuvent venir que de
-- l'athlète. Les rappels côté app (bandeau athlète, liste coach) visent à ce
-- que la clôture manuelle reste le cas normal ; ce cron n'est qu'un filet.

-- ── 1. Détection des saisies dans athlete_modifications ──────────────────────
-- Structure : { sessionSets: { <exerciceId>: [ { kg, reps, rir, done }, … ] } }
-- Une série compte comme saisie dès qu'elle porte une charge ou des reps.

CREATE OR REPLACE FUNCTION public.workout_log_has_entries(mods jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_each(COALESCE(mods, '{}'::jsonb) -> 'sessionSets') AS ex(ex_id, ex_rows)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(ex.ex_rows) = 'array' THEN ex.ex_rows ELSE '[]'::jsonb END
    ) AS s(item)
    WHERE jsonb_typeof(s.item) = 'object'
      AND (
        (s.item ? 'kg'   AND jsonb_typeof(s.item -> 'kg')   <> 'null') OR
        (s.item ? 'reps' AND jsonb_typeof(s.item -> 'reps') <> 'null')
      )
  );
$fn$;

COMMENT ON FUNCTION public.workout_log_has_entries(jsonb) IS
  'true si athlete_modifications contient au moins une série avec charge ou reps.';

-- ── 2. Clôture automatique ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.close_unfinished_workouts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.workout_logs
  SET status       = 'completed',
      completed_at = COALESCE(completed_at, (scheduled_date + TIME '18:00') AT TIME ZONE 'UTC'),
      updated_at   = now()
  WHERE status = 'planned'
    AND scheduled_date < CURRENT_DATE
    AND scheduled_date >= CURRENT_DATE - 30
    AND public.workout_log_has_entries(athlete_modifications);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.close_unfinished_workouts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_unfinished_workouts() TO service_role;

COMMENT ON FUNCTION public.close_unfinished_workouts() IS
  'Passe en completed les séances passées contenant des saisies mais jamais clôturées.';

-- ── 3. mark_missed_workouts : ne marque plus manquée une séance travaillée ───

CREATE OR REPLACE FUNCTION public.mark_missed_workouts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.workout_logs
  SET status = 'missed', updated_at = now()
  WHERE status = 'planned'
    AND scheduled_date < CURRENT_DATE
    AND scheduled_date >= CURRENT_DATE - 30
    AND NOT public.workout_log_has_entries(athlete_modifications);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$fn$;

COMMENT ON FUNCTION public.mark_missed_workouts() IS
  'Marque missed les séances passées SANS aucune saisie. '
  'Les séances travaillées sont clôturées par close_unfinished_workouts().';

-- ── 4. Entretien quotidien : clôture PUIS marquage manquées ──────────────────
-- Regroupé dans une seule fonction : l''ordre est significatif (une séance
-- travaillée doit être clôturée avant que le marquage "missed" ne la voie), et
-- pg_cron n''exécute de façon fiable qu''une seule instruction.

CREATE OR REPLACE FUNCTION public.run_workout_status_maintenance()
RETURNS TABLE (closed integer, missed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  closed := public.close_unfinished_workouts();
  missed := public.mark_missed_workouts();
  RETURN NEXT;
END;
$fn$;

REVOKE ALL ON FUNCTION public.run_workout_status_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_workout_status_maintenance() TO service_role;

COMMENT ON FUNCTION public.run_workout_status_maintenance() IS
  'Entretien quotidien des statuts : clôture les séances travaillées, puis marque missed celles restées vides.';

-- Note : les conditions d''exception ci-dessous sont les noms PL/pgSQL officiels.
--   3F000 → invalid_schema_name   (schéma cron absent = pg_cron non installé)
--   42P01 → undefined_table       (cron.job absent)
--   42883 → undefined_function    (cron.schedule absent)
-- "undefined_schema" n''existe pas et fait échouer la compilation du bloc DO.

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-missed-workouts') THEN
    PERFORM cron.unschedule('mark-missed-workouts');
  END IF;
EXCEPTION
  WHEN invalid_schema_name THEN NULL;
  WHEN undefined_table     THEN NULL;
  WHEN undefined_function  THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END;
$do$;

DO $do$
BEGIN
  PERFORM cron.schedule(
    'mark-missed-workouts',
    '0 3 * * *',
    'SELECT public.run_workout_status_maintenance();'
  );
EXCEPTION
  WHEN invalid_schema_name THEN
    RAISE WARNING 'pg_cron non disponible — activez l''extension (Dashboard → Database → Extensions → pg_cron) puis ré-exécutez cette migration.';
  WHEN undefined_function THEN
    RAISE WARNING 'pg_cron non disponible (cron.schedule introuvable).';
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Droits insuffisants pour planifier le job cron — à créer depuis le Dashboard Supabase.';
END;
$do$;

-- ── 5. Rattrapage immédiat sur l''existant ───────────────────────────────────
-- Les séances déjà marquées 'missed' à tort (saisies présentes) sont réparées.

UPDATE public.workout_logs
SET status       = 'completed',
    completed_at = COALESCE(completed_at, (scheduled_date + TIME '18:00') AT TIME ZONE 'UTC'),
    updated_at   = now()
WHERE status IN ('planned', 'missed')
  AND scheduled_date < CURRENT_DATE
  AND public.workout_log_has_entries(athlete_modifications);
