-- Table des retours/remarques des athlètes
create table if not exists public.retours (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Table des votes (like/dislike)
create table if not exists public.retours_votes (
  id uuid primary key default gen_random_uuid(),
  retour_id uuid not null references public.retours(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  unique(retour_id, user_id)
);

-- RLS retours : lecture pour tous les utilisateurs authentifiés, écriture pour soi-même
alter table public.retours enable row level security;

create policy "Lecture retours pour utilisateurs authentifiés"
  on public.retours for select
  using (auth.uid() is not null);

create policy "Création retour par l'athlète lui-même"
  on public.retours for insert
  with check (auth.uid() = athlete_id);

create policy "Suppression par l'auteur ou un admin"
  on public.retours for delete
  using (
    auth.uid() = athlete_id
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- RLS retours_votes : lecture pour tous, écriture pour soi-même
alter table public.retours_votes enable row level security;

create policy "Lecture votes pour utilisateurs authentifiés"
  on public.retours_votes for select
  using (auth.uid() is not null);

create policy "Vote par l'utilisateur lui-même"
  on public.retours_votes for insert
  with check (auth.uid() = user_id);

create policy "Mise à jour vote par l'utilisateur lui-même"
  on public.retours_votes for update
  using (auth.uid() = user_id);

create policy "Suppression vote par l'utilisateur lui-même"
  on public.retours_votes for delete
  using (auth.uid() = user_id);
