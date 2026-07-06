-- Add modality column for spécifique sessions (AMRAP, EMOM, For Time, etc.)
ALTER TABLE public.energy_sessions
  ADD COLUMN IF NOT EXISTS modality text;
