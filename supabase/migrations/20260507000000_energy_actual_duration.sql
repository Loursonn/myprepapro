-- Allow athlete to log actual duration (may differ from planned total_duration_s)
ALTER TABLE energy_session_assignments
  ADD COLUMN IF NOT EXISTS actual_duration_min integer;

COMMENT ON COLUMN energy_session_assignments.actual_duration_min IS 'Durée réelle saisie par l''athlète en minutes (peut différer du total_duration_s planifié)';
