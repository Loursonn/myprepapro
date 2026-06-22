-- Migration: Allow coaches to INSERT workout_logs for their athletes
-- Root cause: workout_logs had SELECT/UPDATE/DELETE policies for coaches but no INSERT.
-- Coaches need INSERT to place sessions in athlete planning (usePlaceSession, useAssignWorkout).
-- Date: 2026-06-22

CREATE POLICY "workout_logs_coach_insert" ON public.workout_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = workout_logs.athlete_id
        AND p.coach_id = auth.uid()
    )
  );
