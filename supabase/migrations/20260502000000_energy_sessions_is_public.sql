-- Migration : séances énergétiques privées par défaut
-- is_public = false → visible seulement par l'auteur
-- is_public = true  → visible dans la banque publique partagée

-- 1. Colonne is_public
ALTER TABLE public.energy_sessions
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- 2. SELECT : auteur voit ses séances, tout le monde voit les publiques
DROP POLICY IF EXISTS "es_select" ON public.energy_sessions;
CREATE POLICY "es_select"
  ON public.energy_sessions FOR SELECT
  TO authenticated
  USING (is_public = true OR created_by = auth.uid());

-- 3. INSERT : forcer is_public = false à la création
DROP POLICY IF EXISTS "es_insert" ON public.energy_sessions;
CREATE POLICY "es_insert"
  ON public.energy_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('coach', 'coach_athlete')
    )
    AND is_verified = false
    AND is_public = false
  );

-- Index pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_energy_sessions_public
  ON public.energy_sessions (is_public);
