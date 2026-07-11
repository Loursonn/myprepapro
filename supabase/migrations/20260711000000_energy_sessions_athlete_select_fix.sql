-- Fix: athletes must be able to read energy_sessions assigned to them.
-- Previous policy only allowed: is_public, own creations, coach viewing athlete copies.
-- Missing: athlete seeing sessions assigned via energy_session_assignments.

DROP POLICY IF EXISTS "es_select" ON public.energy_sessions;

CREATE POLICY "es_select"
  ON public.energy_sessions FOR SELECT
  TO authenticated
  USING (
    -- Public bank sessions
    is_public = true
    -- Own creations (coach personal bank)
    OR created_by = auth.uid()
    -- Athlete-specific copies (athlete sees own copies)
    OR athlete_id = auth.uid()
    -- Coach sees their athletes' copies
    OR athlete_id IN (
      SELECT id FROM public.profiles WHERE coach_id = auth.uid()
    )
    -- Athlete sees any session assigned to them (even private coach sessions)
    OR id IN (
      SELECT energy_session_id FROM public.energy_session_assignments
      WHERE athlete_id = auth.uid()
    )
  );
