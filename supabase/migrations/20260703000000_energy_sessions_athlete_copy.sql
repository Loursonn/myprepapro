-- Migration : séances énergétiques personnalisées par athlète
-- athlete_id = NULL → séance banque (générale ou coach perso)
-- athlete_id = UUID → copie personnalisée pour un athlète spécifique
-- parent_session_id → traçabilité vers la séance source (banque)

-- 1. Nouvelles colonnes
ALTER TABLE public.energy_sessions
  ADD COLUMN IF NOT EXISTS athlete_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES public.energy_sessions(id) ON DELETE SET NULL;

-- 2. Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_energy_sessions_athlete
  ON public.energy_sessions (athlete_id);
CREATE INDEX IF NOT EXISTS idx_energy_sessions_parent
  ON public.energy_sessions (parent_session_id);

-- 3. RLS SELECT : coach voit banque + séances de ses athlètes
DROP POLICY IF EXISTS "es_select" ON public.energy_sessions;
CREATE POLICY "es_select"
  ON public.energy_sessions FOR SELECT
  TO authenticated
  USING (
    -- Banque publique
    is_public = true
    -- Ses propres séances (banque perso coach)
    OR created_by = auth.uid()
    -- Séances de ses athlètes (coach voit les copies athlète)
    OR athlete_id IN (
      SELECT id FROM public.profiles WHERE coach_id = auth.uid()
    )
    -- L'athlète voit ses propres copies
    OR athlete_id = auth.uid()
  );

-- 4. RLS INSERT : coach peut créer des copies pour ses athlètes
DROP POLICY IF EXISTS "es_insert" ON public.energy_sessions;
CREATE POLICY "es_insert"
  ON public.energy_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_verified = false
    AND (
      -- Création banque perso (pas de athlete_id)
      athlete_id IS NULL
      -- Copie pour un de ses athlètes
      OR athlete_id IN (
        SELECT id FROM public.profiles WHERE coach_id = auth.uid()
      )
    )
  );

-- 5. RLS UPDATE : auteur ou coach de l'athlète peut modifier
DROP POLICY IF EXISTS "es_update_author" ON public.energy_sessions;
CREATE POLICY "es_update_author"
  ON public.energy_sessions FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR athlete_id IN (
      SELECT id FROM public.profiles WHERE coach_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR athlete_id IN (
      SELECT id FROM public.profiles WHERE coach_id = auth.uid()
    )
  );

-- 6. RLS DELETE : auteur ou coach de l'athlète peut supprimer
DROP POLICY IF EXISTS "es_delete" ON public.energy_sessions;
CREATE POLICY "es_delete"
  ON public.energy_sessions FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR athlete_id IN (
      SELECT id FROM public.profiles WHERE coach_id = auth.uid()
    )
  );
