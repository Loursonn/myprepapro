-- exercise_pr_logs: athlete personal records for specific exercise references
-- exercise_ref is a free-text label (e.g. "Développé couché", "Squat")
-- Multiple exercises can share the same ref to pool their RM

CREATE TABLE IF NOT EXISTS public.exercise_pr_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_ref TEXT NOT NULL,          -- canonical reference name (ex: "Développé couché")
  kg          NUMERIC(6,2) NOT NULL,
  date        DATE NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercise_pr_logs_athlete_idx ON public.exercise_pr_logs(athlete_id);
CREATE INDEX IF NOT EXISTS exercise_pr_logs_ref_idx     ON public.exercise_pr_logs(athlete_id, exercise_ref);

-- RLS
ALTER TABLE public.exercise_pr_logs ENABLE ROW LEVEL SECURITY;

-- Athlete sees own PRs
CREATE POLICY "athlete_own_prs" ON public.exercise_pr_logs
  FOR ALL USING (athlete_id = auth.uid());

-- Coach sees athletes' PRs
CREATE POLICY "coach_sees_athlete_prs" ON public.exercise_pr_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = exercise_pr_logs.athlete_id
        AND p.coach_id = auth.uid()
    )
  );

-- Coach can insert/delete PRs for their athletes
CREATE POLICY "coach_insert_athlete_prs" ON public.exercise_pr_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = exercise_pr_logs.athlete_id
        AND p.coach_id = auth.uid()
    )
  );

CREATE POLICY "coach_delete_athlete_prs" ON public.exercise_pr_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = exercise_pr_logs.athlete_id
        AND p.coach_id = auth.uid()
    )
  );
