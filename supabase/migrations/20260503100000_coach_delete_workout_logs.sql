-- Migration: autoriser le coach à supprimer les workout_logs de ses athlètes
-- Nécessaire pour pouvoir supprimer des séances validées en doublon
-- Date: 2026-05-03

CREATE POLICY "workout_logs_coach_delete" ON public.workout_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = workout_logs.athlete_id
        AND p.coach_id = auth.uid()
    )
  );
