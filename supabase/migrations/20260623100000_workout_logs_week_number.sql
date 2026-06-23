-- Add week_number to workout_logs so single-placement sessions know which
-- week's params to use (multi-semaine programs without a microcycle link).
ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS week_number INTEGER;
