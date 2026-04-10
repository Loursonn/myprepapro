-- Ajouter is_admin aux profils (le créateur de la banque = admin)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- ── RLS sur la table exercises ────────────────────────────────────────────────

-- S'assurer que RLS est activé
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Lecture : tout le monde (y compris non connecté)
DROP POLICY IF EXISTS "exercises_select_all" ON public.exercises;
CREATE POLICY "exercises_select_all" ON public.exercises
  FOR SELECT USING (true);

-- Insert Communauté : tout coach/coach_athlete authentifié, is_verified doit être false
DROP POLICY IF EXISTS "exercises_insert_coach" ON public.exercises;
CREATE POLICY "exercises_insert_coach" ON public.exercises
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND is_verified = false
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'coach_athlete')
    )
  );

-- Insert Officiel : admin uniquement (is_verified true ou false)
DROP POLICY IF EXISTS "exercises_insert_admin" ON public.exercises;
CREATE POLICY "exercises_insert_admin" ON public.exercises
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Update : admin peut tout modifier (dont promouvoir is_verified)
DROP POLICY IF EXISTS "exercises_update_admin" ON public.exercises;
CREATE POLICY "exercises_update_admin" ON public.exercises
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Update : un coach peut modifier ses propres exercices Communauté
DROP POLICY IF EXISTS "exercises_update_own" ON public.exercises;
CREATE POLICY "exercises_update_own" ON public.exercises
  FOR UPDATE USING (
    created_by = auth.uid() AND is_verified = false
  );

-- Delete : admin ou propriétaire de l'exercice (Communauté uniquement)
DROP POLICY IF EXISTS "exercises_delete_admin" ON public.exercises;
CREATE POLICY "exercises_delete_admin" ON public.exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
    OR (created_by = auth.uid() AND is_verified = false)
  );
