-- Add schema column (JSONB) for field drawings (arrows, cones, text on terrain)
ALTER TABLE public.energy_sessions
  ADD COLUMN IF NOT EXISTS schema JSONB DEFAULT NULL;

COMMENT ON COLUMN public.energy_sessions.schema IS 'Optional field schema drawing (terrain + elements: arrows, lines, cones, text)';
