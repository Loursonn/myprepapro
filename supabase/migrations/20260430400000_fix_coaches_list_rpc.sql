-- Fix: column "id" is ambiguous in get_coaches_list() and related functions
-- The function returns TABLE(id uuid, ...) so bare "id" clashes with the column name.
-- Fix: qualify all bare "id" references with the table alias "profiles.id".

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
    WHERE profiles.id = auth.uid() AND profiles.is_certified_coach = true
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
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin required';
  END IF;

  IF p_target_id = auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: cannot modify own certification';
  END IF;

  UPDATE public.profiles
  SET is_certified_coach = p_certified
  WHERE profiles.id = p_target_id;
END;
$$;

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
    IF auth.uid() IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.is_admin = true
      ) THEN
        RAISE EXCEPTION 'Forbidden: only admins can change is_admin or is_certified_coach';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
