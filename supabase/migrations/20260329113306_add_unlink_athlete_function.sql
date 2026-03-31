-- Function to unlink an athlete from their coach
-- SECURITY DEFINER runs as the function owner (bypasses RLS)
-- but verifies the caller is actually the athlete's coach
CREATE OR REPLACE FUNCTION unlink_athlete(athlete_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow if the calling user is actually the coach of this athlete
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = athlete_id AND coach_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles SET coach_id = NULL WHERE id = athlete_id;
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION unlink_athlete(UUID) TO authenticated;
