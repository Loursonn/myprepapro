-- Add rpe_score and block_logs to energy session assignments
ALTER TABLE energy_session_assignments
  ADD COLUMN IF NOT EXISTS rpe_score smallint,
  ADD COLUMN IF NOT EXISTS block_logs jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN energy_session_assignments.rpe_score IS 'Foster RPE 1-10 submitted by athlete after session';
COMMENT ON COLUMN energy_session_assignments.block_logs IS 'Per-work-block completion: { [intervalId]: { done: boolean, note?: string } }';
