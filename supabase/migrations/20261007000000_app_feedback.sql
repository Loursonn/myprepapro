-- Retours des athlètes sur l'application (bugs, idées) — affichés côté coach dans "Avis athlètes"

CREATE TABLE IF NOT EXISTS public.app_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind        text NOT NULL DEFAULT 'bug' CHECK (kind IN ('bug','idea','other')),
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  page        text,
  user_agent  text,
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','done')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_feedback_created ON public.app_feedback(created_at DESC);

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

-- Insertion : tout utilisateur connecté, pour lui-même
CREATE POLICY "app_feedback_insert_own" ON public.app_feedback
  FOR INSERT WITH CHECK (author_id = auth.uid());

-- Lecture : l'auteur, ou coach certifié / admin (mêmes droits que la Roadmap)
CREATE POLICY "app_feedback_select" ON public.app_feedback
  FOR SELECT USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_certified_coach = true OR p.is_admin = true)
    )
  );

-- Mise à jour du statut / suppression : coach certifié ou admin
CREATE POLICY "app_feedback_update" ON public.app_feedback
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_certified_coach = true OR p.is_admin = true)
    )
  );

CREATE POLICY "app_feedback_delete" ON public.app_feedback
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_certified_coach = true OR p.is_admin = true)
    )
  );
