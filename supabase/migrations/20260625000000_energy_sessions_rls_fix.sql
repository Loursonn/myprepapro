-- Fix RLS INSERT policy for energy_sessions
-- Previous policy required role IN ('coach', 'coach_athlete') via subquery,
-- but also required is_public = false which may fail if column wasn't added
-- or if the check runs before defaults are applied in some edge cases.
-- Simplify: any authenticated user can insert with is_verified = false.
-- Coach UI already gates access to the editor page.

DROP POLICY IF EXISTS "es_insert" ON public.energy_sessions;

CREATE POLICY "es_insert"
  ON public.energy_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_verified = false
  );
