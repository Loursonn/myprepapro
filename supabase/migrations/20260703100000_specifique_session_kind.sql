-- Extend session_kind CHECK to include 'specifique'
-- Original constraint name from 20260501 migration is 'energy_sessions_kind_check'
ALTER TABLE public.energy_sessions
  DROP CONSTRAINT IF EXISTS energy_sessions_kind_check;
ALTER TABLE public.energy_sessions
  DROP CONSTRAINT IF EXISTS energy_sessions_kind_valid;

ALTER TABLE public.energy_sessions
  ADD CONSTRAINT energy_sessions_kind_check
  CHECK (session_kind IN ('vo2','tempo','seuil','footing','fartlek','autre','custom','specifique'));
