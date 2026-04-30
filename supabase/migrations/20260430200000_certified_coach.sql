-- Migration: statut coach certifié + onglet coachs
-- 2026-04-30

-- ── 1. Colonne is_certified_coach ────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_certified_coach boolean NOT NULL DEFAULT false;

-- ── 2. Seed Hugo TANGUY et Titouan MAUMEGE (idempotent par coach_code) ───────

UPDATE public.profiles
SET is_certified_coach = true, is_admin = true
WHERE coach_code = 'R4BL7M';   -- Hugo TANGUY

UPDATE public.profiles
SET is_certified_coach = true, is_admin = true
WHERE coach_code = 'E7CJRR';   -- Titouan MAUMEGE

-- ── 3. RPC : liste des coachs (SECURITY DEFINER — réservé aux certifiés) ─────

CREATE OR REPLACE FUNCTION public.get_coaches_list()
RETURNS TABLE (
  id                 uuid,
  full_name          text,
  coach_code         text,
  created_at         timestamptz,
  is_admin           boolean,
  is_certified_coach boolean,
  athlete_count      bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_certified_coach = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: certified coach required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.coach_code,
    p.created_at,
    p.is_admin,
    p.is_certified_coach,
    COUNT(a.id)::bigint AS athlete_count
  FROM public.profiles p
  LEFT JOIN public.profiles a ON a.coach_id = p.id
  WHERE p.role IN ('coach', 'coach_athlete')
  GROUP BY p.id, p.full_name, p.coach_code, p.created_at, p.is_admin, p.is_certified_coach
  ORDER BY p.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coaches_list() TO authenticated;

-- ── 4. RPC : toggle is_certified_coach (admin seulement) ─────────────────────
-- Un admin ne peut pas révoquer le statut admin via l'UI (sécurité — SQL uniquement).
-- Un admin ne peut pas modifier ses propres flags.

CREATE OR REPLACE FUNCTION public.toggle_coach_certification(
  p_target_id uuid,
  p_certified  boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérification appelant = admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin required';
  END IF;

  -- Interdiction de modifier ses propres flags
  IF p_target_id = auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot modify own certification';
  END IF;

  UPDATE public.profiles
  SET is_certified_coach = p_certified
  WHERE id = p_target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_coach_certification(uuid, boolean) TO authenticated;

-- ── 5. RLS : protection de is_certified_coach et is_admin ────────────────────
-- La politique "Users can update own profile" et "coaches_can_update_athlete_profiles"
-- permettent à quiconque de modifier n'importe quel champ de son propre profil,
-- y compris is_certified_coach. On ajoute un trigger BEFORE UPDATE pour bloquer
-- toute modification de ces champs en dehors des fonctions SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.prevent_flag_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin
      OR NEW.is_certified_coach IS DISTINCT FROM OLD.is_certified_coach)
  THEN
    -- Pas de contexte auth = migration SQL directe ou seed → autoriser
    IF auth.uid() IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
      ) THEN
        RAISE EXCEPTION 'Forbidden: only admins can change is_admin or is_certified_coach';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_flag_update ON public.profiles;
CREATE TRIGGER trg_prevent_flag_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_flag_self_update();
