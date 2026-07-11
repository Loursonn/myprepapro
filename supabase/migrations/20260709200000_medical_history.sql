-- Medical history table (one row per athlete)
CREATE TABLE IF NOT EXISTS public.medical_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  conditions TEXT DEFAULT '',       -- pathologies/conditions (texte libre)
  allergies TEXT DEFAULT '',        -- allergies (texte libre)
  surgeries JSONB DEFAULT '[]',    -- [{zone, date, details}]
  past_injuries JSONB DEFAULT '[]', -- [{zone, date, type, details}]
  current_treatments TEXT DEFAULT '', -- traitements en cours
  medical_notes TEXT DEFAULT '',     -- remarques libres
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Update trigger
CREATE TRIGGER set_medical_history_updated_at
  BEFORE UPDATE ON public.medical_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;

-- Athlete can manage own record
CREATE POLICY "athlete_own_medical"
  ON public.medical_history FOR ALL
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- Coach can read their athletes' records
CREATE POLICY "coach_read_athlete_medical"
  ON public.medical_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = medical_history.athlete_id
        AND coach_id = auth.uid()
    )
  );
