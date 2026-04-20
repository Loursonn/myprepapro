-- Séances Énergétiques, Tests, Performances

-- 1. Banque d'exercices énergétiques
CREATE TABLE IF NOT EXISTS public.energy_exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  type         text NOT NULL,
  custom_type  text,
  description  text,
  photo_url    text,
  is_official  boolean DEFAULT false,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.energy_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "energy_ex_select" ON public.energy_exercises FOR SELECT USING (true);
CREATE POLICY "energy_ex_insert" ON public.energy_exercises FOR INSERT WITH CHECK (
  auth.uid() = created_by OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "energy_ex_update" ON public.energy_exercises FOR UPDATE USING (
  auth.uid() = created_by OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "energy_ex_delete" ON public.energy_exercises FOR DELETE USING (
  auth.uid() = created_by OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 2. Configuration énergétique d'une session (coach)
CREATE TABLE IF NOT EXISTS public.energy_session_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id       uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  session_key      text NOT NULL,
  session_label    text,
  appareil_types   text[] NOT NULL DEFAULT '{}',
  custom_appareils text[] DEFAULT '{}',
  modalite         text NOT NULL DEFAULT 'intermittent',
  custom_modalite  text,
  blocks           jsonb NOT NULL DEFAULT '[]',
  photo_url        text,
  energy_exercise_id uuid REFERENCES public.energy_exercises(id) ON DELETE SET NULL,
  note_coach       text,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(athlete_id, session_key)
);

ALTER TABLE public.energy_session_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "energy_cfg_select" ON public.energy_session_config FOR SELECT USING (
  athlete_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('coach','coach_athlete') OR is_admin = true))
);
CREATE POLICY "energy_cfg_insert" ON public.energy_session_config FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('coach','coach_athlete') OR is_admin = true))
);
CREATE POLICY "energy_cfg_update" ON public.energy_session_config FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('coach','coach_athlete') OR is_admin = true))
);
CREATE POLICY "energy_cfg_delete" ON public.energy_session_config FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('coach','coach_athlete') OR is_admin = true))
);

-- 3. Logs athlète — séances énergétiques
CREATE TABLE IF NOT EXISTS public.energy_workout_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  session_key       text NOT NULL,
  session_label     text,
  date              date NOT NULL DEFAULT CURRENT_DATE,
  completed         boolean DEFAULT false,
  respected         boolean,
  duration_min      integer,
  distance_m        integer,
  meteo             text[] DEFAULT '{}',
  lieu              text,
  lieu_custom       text,
  note              text,
  garmin_url        text,
  garmin_expires_at timestamptz,
  interval_logs     jsonb DEFAULT '[]',
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.energy_workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "energy_log_select" ON public.energy_workout_logs FOR SELECT USING (
  athlete_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('coach','coach_athlete') OR is_admin = true))
);
CREATE POLICY "energy_log_insert" ON public.energy_workout_logs FOR INSERT WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "energy_log_update" ON public.energy_workout_logs FOR UPDATE USING (athlete_id = auth.uid());
CREATE POLICY "energy_log_delete" ON public.energy_workout_logs FOR DELETE USING (athlete_id = auth.uid());

-- 4. Séances test
CREATE TABLE IF NOT EXISTS public.test_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id          uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  coach_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type                text NOT NULL DEFAULT 'musculation',
  custom_type         text,
  title               text NOT NULL,
  description         text,
  reference_file_url  text,
  reference_file_type text,
  date                date NOT NULL DEFAULT CURRENT_DATE,
  completed           boolean DEFAULT false,
  results_structured  jsonb DEFAULT '{}',
  results_note        text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_select" ON public.test_sessions FOR SELECT USING (
  athlete_id = auth.uid() OR coach_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "test_insert" ON public.test_sessions FOR INSERT WITH CHECK (
  athlete_id = auth.uid() OR coach_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "test_update" ON public.test_sessions FOR UPDATE USING (
  athlete_id = auth.uid() OR coach_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "test_delete" ON public.test_sessions FOR DELETE USING (
  athlete_id = auth.uid() OR coach_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 5. Logs de performance
CREATE TABLE IF NOT EXISTS public.performance_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id          uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  metric_type         text NOT NULL,
  metric_name         text NOT NULL,
  value               numeric NOT NULL,
  unit                text NOT NULL,
  custom_unit         text,
  date                date NOT NULL DEFAULT CURRENT_DATE,
  test_session_id     uuid REFERENCES public.test_sessions(id) ON DELETE SET NULL,
  is_active_reference boolean DEFAULT false,
  coach_validated     boolean,
  notes               text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS perf_active_ref_unique
  ON public.performance_logs (athlete_id, metric_name)
  WHERE is_active_reference = true;

ALTER TABLE public.performance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_select" ON public.performance_logs FOR SELECT USING (
  athlete_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('coach','coach_athlete') OR is_admin = true))
);
CREATE POLICY "perf_insert" ON public.performance_logs FOR INSERT WITH CHECK (
  athlete_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('coach','coach_athlete') OR is_admin = true))
);
CREATE POLICY "perf_update" ON public.performance_logs FOR UPDATE USING (
  athlete_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('coach','coach_athlete') OR is_admin = true))
);
CREATE POLICY "perf_delete" ON public.performance_logs FOR DELETE USING (
  athlete_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('coach','coach_athlete') OR is_admin = true))
);

-- 6. Notifications coach — validation perf
CREATE TABLE IF NOT EXISTS public.performance_notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id            uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  athlete_id          uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  performance_log_id  uuid REFERENCES public.performance_logs(id) ON DELETE CASCADE NOT NULL,
  status              text DEFAULT 'pending',
  created_at          timestamptz DEFAULT now(),
  resolved_at         timestamptz
);

ALTER TABLE public.performance_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_notif_select" ON public.performance_notifications FOR SELECT USING (
  coach_id = auth.uid() OR athlete_id = auth.uid()
);
CREATE POLICY "perf_notif_insert" ON public.performance_notifications FOR INSERT WITH CHECK (
  athlete_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "perf_notif_update" ON public.performance_notifications FOR UPDATE USING (
  coach_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 7. Fonction : activer une référence perf
CREATE OR REPLACE FUNCTION public.set_active_performance_reference(
  p_performance_log_id uuid,
  p_athlete_id uuid,
  p_metric_name text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.performance_logs
  SET is_active_reference = false
  WHERE athlete_id = p_athlete_id
    AND metric_name = p_metric_name
    AND is_active_reference = true;

  UPDATE public.performance_logs
  SET is_active_reference = true
  WHERE id = p_performance_log_id;
END;
$$;

-- 8. Storage bucket : screenshots Garmin
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'garmin-screenshots',
  'garmin-screenshots',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "garmin_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'garmin-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "garmin_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'garmin-screenshots' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('coach','coach_athlete') OR is_admin = true))
  )
);
CREATE POLICY "garmin_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'garmin-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 9. Storage bucket : fichiers de test
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'test-files',
  'test-files',
  false,
  20971520,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "test_files_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'test-files' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "test_files_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'test-files' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('coach','coach_athlete') OR is_admin = true))
  )
);
CREATE POLICY "test_files_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'test-files' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 10. Storage bucket : photos exercices énergétiques
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'energy-exercise-photos',
  'energy-exercise-photos',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "energy_photo_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'energy-exercise-photos' AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role IN ('coach','coach_athlete') OR is_admin = true))
);
CREATE POLICY "energy_photo_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'energy-exercise-photos'
);
CREATE POLICY "energy_photo_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'energy-exercise-photos' AND auth.uid()::text = (storage.foldername(name))[1]
);
