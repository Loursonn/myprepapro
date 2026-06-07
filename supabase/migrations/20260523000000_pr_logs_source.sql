-- Add source tracking to exercise_pr_logs
ALTER TABLE public.exercise_pr_logs
  ADD COLUMN IF NOT EXISTS source       TEXT    NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_reps  INTEGER,
  ADD COLUMN IF NOT EXISTS source_kg    NUMERIC(6,2);

-- source: 'manual' | 'computed' (Epley from session sets)
