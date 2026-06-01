-- Mensurations + photos d'évolution corporelle
-- L'athlète saisit ses mensurations (cm) + photos à une date donnée.
-- Le poids (kg) est un snapshot repris depuis le wellness de la même date.

create table if not exists public.measurement_logs (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.profiles(id) on delete cascade,
  date        date not null default current_date,

  -- Poids du jour (snapshot wellness à la date de saisie, kg)
  weight_kg   numeric,

  -- Mensurations (cm) — toutes nullable
  bras        numeric,
  epaules     numeric,
  poitrine    numeric,
  taille      numeric,
  hanche      numeric,
  cuisse      numeric,
  mollet      numeric,

  -- Photos : { face, cote, dos, jambes_face, jambes_dos } -> chemin storage (bucket test-media)
  photos      jsonb not null default '{}'::jsonb,

  created_at  timestamptz not null default now()
);

create index if not exists measurement_logs_athlete_date_idx
  on public.measurement_logs (athlete_id, date desc);

alter table public.measurement_logs enable row level security;

-- L'athlète gère ses propres saisies
create policy "athlete_own_measurements" on public.measurement_logs
  for all to authenticated
  using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

-- Le coach lit les saisies de ses athlètes
create policy "coach_read_measurements" on public.measurement_logs
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = public.measurement_logs.athlete_id
        and p.coach_id = auth.uid()
    )
  );
