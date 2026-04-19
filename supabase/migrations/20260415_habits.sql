-- Tracker d'habitudes — activation par coach, suivi quotidien athlète

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS habit_tracker_enabled boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '💪',
  color text NOT NULL DEFAULT '#F5A623',
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid REFERENCES public.habits(id) ON DELETE CASCADE NOT NULL,
  athlete_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  UNIQUE(habit_id, date)
);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

-- habits : athlète gère les siennes, coach/admin lecture
CREATE POLICY "habits_select" ON public.habits FOR SELECT USING (
  athlete_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'coach' OR is_admin = true))
);
CREATE POLICY "habits_insert" ON public.habits FOR INSERT WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "habits_update" ON public.habits FOR UPDATE USING (athlete_id = auth.uid());
CREATE POLICY "habits_delete" ON public.habits FOR DELETE USING (athlete_id = auth.uid());

-- habit_logs : même pattern
CREATE POLICY "habit_logs_select" ON public.habit_logs FOR SELECT USING (
  athlete_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'coach' OR is_admin = true))
);
CREATE POLICY "habit_logs_insert" ON public.habit_logs FOR INSERT WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "habit_logs_update" ON public.habit_logs FOR UPDATE USING (athlete_id = auth.uid());
CREATE POLICY "habit_logs_delete" ON public.habit_logs FOR DELETE USING (athlete_id = auth.uid());
