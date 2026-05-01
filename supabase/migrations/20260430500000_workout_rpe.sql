-- RPE post-séance (Foster 1-10)
create table if not exists workout_rpe (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references workout_logs(id) on delete cascade,
  athlete_id  uuid not null references profiles(id) on delete cascade,
  rpe_score   smallint not null check (rpe_score between 1 and 10),
  created_at  timestamptz not null default now(),
  constraint workout_rpe_workout_unique unique (workout_id)
);

alter table workout_rpe enable row level security;

-- Athlète : lire/écrire son propre RPE
drop policy if exists "athlete_own_rpe" on workout_rpe;
create policy "athlete_own_rpe" on workout_rpe
  for all using (athlete_id = auth.uid());

-- Coach : lire RPE de ses athlètes
drop policy if exists "coach_read_athlete_rpe" on workout_rpe;
create policy "coach_read_athlete_rpe" on workout_rpe
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = workout_rpe.athlete_id
        and profiles.coach_id = auth.uid()
    )
  );
