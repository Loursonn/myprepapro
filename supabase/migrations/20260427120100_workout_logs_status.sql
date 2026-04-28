-- Migration B — Table workout_logs avec statut de séance
-- NOTE ARCHITECTURE : Les données workout actuelles sont stockées dans app_data JSONB
-- (clés asp:completed, asp:sessions, asp:sessionlogs).
-- Cette migration crée une table DÉDIÉE pour les nouvelles séances (future-proof).
-- Les données historiques dans app_data ne sont PAS migrées ici (migration séparée si besoin).
-- 2026-04-27

-- ── Table workout_logs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id      TEXT NOT NULL, -- référence à app_data asp:sessions[].id (slug)
  session_name    TEXT NOT NULL,
  scheduled_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned', 'in_progress', 'completed', 'missed', 'skipped')),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_s      INTEGER, -- durée effective en secondes
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contrainte : un athlète ne peut avoir qu'un seul log par (session_id, scheduled_date)
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_unique
  ON public.workout_logs (athlete_id, session_id, scheduled_date);

-- Indexes pour les requêtes courantes
CREATE INDEX IF NOT EXISTS idx_workout_logs_athlete_date
  ON public.workout_logs (athlete_id, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_workout_logs_status_date
  ON public.workout_logs (status, scheduled_date);

CREATE INDEX IF NOT EXISTS idx_workout_logs_coach
  ON public.workout_logs (coach_id);

-- ── Trigger : updated_at automatique ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'set_workout_logs_updated_at'
      AND event_object_table = 'workout_logs'
  ) THEN
    CREATE TRIGGER set_workout_logs_updated_at
      BEFORE UPDATE ON public.workout_logs
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

-- Athlète : lit et modifie ses propres logs
CREATE POLICY "workout_logs_self" ON public.workout_logs
  FOR ALL USING (athlete_id = auth.uid());

-- Coach : lit les logs de SES athlètes uniquement
CREATE POLICY "workout_logs_coach_read" ON public.workout_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = workout_logs.athlete_id
        AND p.coach_id = auth.uid()
    )
  );

-- Coach : peut aussi mettre à jour le statut (ex: marquer "missed")
CREATE POLICY "workout_logs_coach_update" ON public.workout_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = workout_logs.athlete_id
        AND p.coach_id = auth.uid()
    )
  );
