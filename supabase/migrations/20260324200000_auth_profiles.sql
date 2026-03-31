-- Profils utilisateurs (coach ou athlète)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('coach', 'athlete')),
  full_name TEXT NOT NULL,
  coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Un utilisateur voit son propre profil
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Un coach voit les profils de ses athlètes
CREATE POLICY "profiles_select_athletes" ON public.profiles
  FOR SELECT USING (coach_id = auth.uid());

-- Un utilisateur crée son propre profil
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Un utilisateur modifie son propre profil
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Invitations envoyées par les coachs
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  email TEXT,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Un coach gère ses invitations
CREATE POLICY "invitations_coach" ON public.invitations
  FOR ALL USING (coach_id = auth.uid());

-- N'importe qui peut lire une invitation par token (pour accepter le lien)
CREATE POLICY "invitations_read_by_token" ON public.invitations
  FOR SELECT USING (true);
