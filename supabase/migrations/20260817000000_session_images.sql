-- Add images JSONB column to energy_sessions for session illustrations
ALTER TABLE energy_sessions
  ADD COLUMN IF NOT EXISTS images jsonb DEFAULT NULL;

COMMENT ON COLUMN energy_sessions.images IS 'Array of {url, caption?} for session illustration photos';
