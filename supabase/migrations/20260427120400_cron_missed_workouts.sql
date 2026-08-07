-- Migration F — Job pg_cron : marquer les séances workout_logs comme 'missed'
-- Pré-requis : pg_cron activé dans Supabase Dashboard → Database → Extensions
-- Si pg_cron n'est pas actif, ce fichier doit être ignoré (voir DB_MIGRATIONS.md).
-- 2026-04-27
--
-- Ce cron agit sur la table workout_logs (créée en Migration B).
-- Les données historiques dans app_data (asp:completed) ne sont pas affectées.
--
-- Planification : 3h UTC chaque jour (≈ minuit heure locale France en hiver).
-- Ajuste l'heure selon le fuseau horaire de tes utilisateurs.

-- Supprimer le job existant s'il existe (idempotence)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'mark-missed-workouts'
  ) THEN
    PERFORM cron.unschedule('mark-missed-workouts');
  END IF;
EXCEPTION
  -- pg_cron pas activé → on ignore silencieusement
  WHEN invalid_schema_name THEN NULL;
  WHEN undefined_table     THEN NULL;
  WHEN undefined_function  THEN NULL;
END;
$do$;

-- Création du job cron (uniquement si pg_cron est disponible)
-- NB : dollar-quoting distinct ($do$ / $job$). Avec $$ des deux côtés, le $$
-- interne referme le bloc DO et le fichier entier devient invalide.
DO $do$
BEGIN
  PERFORM cron.schedule(
    'mark-missed-workouts',
    '0 3 * * *',  -- 3h UTC chaque jour
    $job$
      UPDATE public.workout_logs
      SET status = 'missed', updated_at = now()
      WHERE status = 'planned'
        AND scheduled_date < CURRENT_DATE
        AND scheduled_date >= CURRENT_DATE - 30;  -- limite aux 30 derniers jours
    $job$
  );
EXCEPTION
  -- pg_cron pas activé → on log un warning, pas d'erreur fatale
  WHEN invalid_schema_name THEN
    RAISE WARNING 'pg_cron non disponible. Activez l''extension dans Supabase Dashboard → Database → Extensions → pg_cron, puis ré-exécutez cette migration.';
  WHEN undefined_function THEN
    RAISE WARNING 'pg_cron non disponible (cron.schedule non trouvé).';
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Droits insuffisants pour planifier le job cron.';
END;
$do$;

COMMENT ON TABLE public.workout_logs IS
  'Logs des séances avec statut. '
  'Un cron pg_cron (mark-missed-workouts, 3h UTC) passe automatiquement les séances '
  'planifiées non démarrées de la veille en status=missed.';

-- ── Fonction alternative : marquer missed manuellement (sans pg_cron) ────────
-- À appeler depuis une Edge Function Supabase si pg_cron n'est pas disponible.
CREATE OR REPLACE FUNCTION public.mark_missed_workouts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER  -- Edge Function appelle en anonyme, besoin de bypasser RLS
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

-- Cette fonction ne doit être appelée que par un service (Edge Function avec service_role key)
REVOKE ALL ON FUNCTION public.mark_missed_workouts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_missed_workouts() TO service_role;

COMMENT ON FUNCTION public.mark_missed_workouts() IS
  'Marque comme missed les séances planifiées non démarrées de la veille. '
  'À appeler depuis une Edge Function Supabase avec service_role si pg_cron est indisponible.';
