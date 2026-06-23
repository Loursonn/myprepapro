-- Migration: Add athlete-side fields to workout_logs + sort_order to habits
-- workout_logs missing: athlete_modifications, original_scheduled_date,
--   rescheduled_by_athlete, coach_alert
-- habits missing: sort_order

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS athlete_modifications JSONB,
  ADD COLUMN IF NOT EXISTS original_scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS rescheduled_by_athlete BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS coach_alert BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;
