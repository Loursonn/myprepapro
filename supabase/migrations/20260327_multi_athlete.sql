-- Migration : support multi-athlètes + code coach + rôle coach_athlete

-- 1. Ajout du coach_code sur profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_code TEXT UNIQUE;

-- 2. Support du rôle coach_athlete
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('coach', 'athlete', 'coach_athlete'));

-- 3. Recréation de app_data avec athlete_id (on repart de zéro)
DROP TABLE IF EXISTS public.app_data CASCADE;

CREATE TABLE public.app_data (
  athlete_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (athlete_id, key)
);

ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

-- L'athlète lit/écrit ses propres données
CREATE POLICY "app_data_self" ON public.app_data
  FOR ALL USING (athlete_id = auth.uid());

-- Le coach lit/écrit les données de ses athlètes
CREATE POLICY "app_data_coach" ON public.app_data
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = app_data.athlete_id
        AND p.coach_id = auth.uid()
    )
  );
