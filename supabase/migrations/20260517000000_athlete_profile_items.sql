-- Profil sportif synthétique par catégorie : items notés /5 (ajustables par le coach).
-- Couche "synthèse" distincte des résultats de tests bruts.

create table if not exists public.athlete_profile_items (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.profiles(id) on delete cascade,
  category    text not null check (category in
              ('bilan_articulaire', 'endurance', 'force', 'explosivite', 'vitesse')),
  label       text not null,
  rating      numeric,          -- note /5 (0 à 5, pas de 0.5), null = non noté
  note        text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists athlete_profile_items_idx
  on public.athlete_profile_items (athlete_id, category, sort_order);

alter table public.athlete_profile_items enable row level security;

-- Lecture : athlète (le sien), son coach, admin
create policy "api_select" on public.athlete_profile_items
  for select using (
    athlete_id = auth.uid()
    or public.is_coach_of(athlete_id)
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Écriture : coach de l'athlète, admin
create policy "api_all_coach" on public.athlete_profile_items
  for all using (
    public.is_coach_of(athlete_id)
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  ) with check (
    public.is_coach_of(athlete_id)
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
