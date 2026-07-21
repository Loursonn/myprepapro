-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : coach certifié peut modifier les caractéristiques de n'importe
-- quel exercice de la banque (tri/filtres : type, muscles, équipement…).
-- Même logique que energy_sessions (es_update_certify).
-- 2026-07-18
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "exercises_update_certified" ON public.exercises;
CREATE POLICY "exercises_update_certified" ON public.exercises
  FOR UPDATE
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
