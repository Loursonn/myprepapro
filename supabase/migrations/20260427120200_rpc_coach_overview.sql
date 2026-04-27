-- Migration C — RPC get_coach_overview
-- Consolide les 5 requêtes séparées du Home coach en un seul appel réseau.
-- 2026-04-27
--
-- CHOIX DE SÉCURITÉ : SECURITY INVOKER (défaut)
-- Raison : la fonction s'exécute avec les permissions de l'utilisateur appelant.
-- auth.uid() = coach_uuid au moment de l'appel (JWT Supabase).
-- Les RLS existantes sur app_data (app_data_coach) et competitions (competitions_select)
-- s'appliquent automatiquement — le coach ne peut voir que ses propres athlètes.
-- SECURITY DEFINER serait plus performant (évite la réévaluation des RLS) mais
-- dangereux si la fonction est appelée avec un coach_uuid arbitraire sans vérification.

CREATE OR REPLACE FUNCTION public.get_coach_overview(coach_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_athlete_ids uuid[];
  v_today       date := CURRENT_DATE;
  v_yesterday   date := CURRENT_DATE - 1;
  v_30_days     date := CURRENT_DATE + 30;
  v_result      jsonb;
BEGIN
  -- Sécurité : le coach ne peut demander que ses propres données
  IF auth.uid() != coach_uuid THEN
    RAISE EXCEPTION 'Accès refusé : coach_uuid ne correspond pas à l''utilisateur connecté';
  END IF;

  -- 1. IDs des athlètes de ce coach
  SELECT array_agg(id) INTO v_athlete_ids
  FROM public.profiles
  WHERE coach_id = coach_uuid;

  -- Pas d'athlètes → retourne un état vide
  IF v_athlete_ids IS NULL OR array_length(v_athlete_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'athlete_count',       0,
      'competitions_count',  0,
      'wellness_today',      '[]'::jsonb,
      'wellness_history',    '[]'::jsonb,
      'sessions_data',       '[]'::jsonb,
      'competitions_upcoming','[]'::jsonb,
      'recent_activity',     '[]'::jsonb
    );
  END IF;

  SELECT jsonb_build_object(
    -- KPI : nombre d'athlètes
    'athlete_count', array_length(v_athlete_ids, 1),

    -- KPI : compétitions dans les 30 prochains jours
    'competitions_count', (
      SELECT COUNT(*)
      FROM public.competitions
      WHERE athlete_id = ANY(v_athlete_ids)
        AND date >= v_today
        AND date <= v_30_days
    ),

    -- Wellness du jour (score + détails) par athlète
    'wellness_today', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'athlete_id', athlete_id,
        'value', value
      ))
      FROM public.app_data
      WHERE athlete_id = ANY(v_athlete_ids)
        AND key = 'asp:wellness'
    ), '[]'::jsonb),

    -- Historique wellness (7 derniers jours) pour détection surcharge
    'wellness_history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'athlete_id', athlete_id,
        'value', value
      ))
      FROM public.app_data
      WHERE athlete_id = ANY(v_athlete_ids)
        AND key = 'asp:wh'
    ), '[]'::jsonb),

    -- Données sessions (blockConfig + sessions + completed) pour ratio + missed
    'sessions_data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'athlete_id', athlete_id,
        'key', key,
        'value', value
      ))
      FROM public.app_data
      WHERE athlete_id = ANY(v_athlete_ids)
        AND key IN ('asp:completed', 'asp:blockConfig', 'asp:sessions')
    ), '[]'::jsonb),

    -- Compétitions à venir (données complètes pour AlertCards)
    'competitions_upcoming', COALESCE((
      SELECT jsonb_agg(row_to_json(c.*)::jsonb ORDER BY c.date ASC)
      FROM public.competitions c
      WHERE c.athlete_id = ANY(v_athlete_ids)
        AND c.date >= v_today
        AND c.date <= v_30_days
    ), '[]'::jsonb),

    -- Activité récente (app_data mis à jour) pour la timeline
    'recent_activity', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'athlete_id', athlete_id,
        'key', key,
        'updated_at', updated_at
      ) ORDER BY updated_at DESC)
      FROM (
        SELECT athlete_id, key, updated_at
        FROM public.app_data
        WHERE athlete_id = ANY(v_athlete_ids)
          AND key IN ('asp:sessionlogs', 'asp:wh')
        ORDER BY updated_at DESC
        LIMIT 30
      ) sub
    ), '[]'::jsonb)

  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Accès : utilisateurs authentifiés seulement (anon ne peut pas appeler)
REVOKE ALL ON FUNCTION public.get_coach_overview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coach_overview(uuid) TO authenticated;

-- Commentaire
COMMENT ON FUNCTION public.get_coach_overview(uuid) IS
  'Retourne toutes les données agrégées du Home coach en un seul appel. '
  'Sécurité INVOKER : les RLS s''appliquent, coach_uuid doit = auth.uid().';
