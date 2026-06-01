-- Permettre aux coachs de modifier entièrement les presets globaux + leurs variables.
-- (Usage personnel / mono-coach pour l'instant : tout coach peut éditer la banque preset.)

drop policy if exists "td_update_coach" on public.test_definitions;
create policy "td_update_coach" on public.test_definitions
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

drop policy if exists "td_delete_coach" on public.test_definitions;
create policy "td_delete_coach" on public.test_definitions
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

drop policy if exists "tv_insert_coach" on public.test_variables;
create policy "tv_insert_coach" on public.test_variables
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

drop policy if exists "tv_update_coach" on public.test_variables;
create policy "tv_update_coach" on public.test_variables
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );

drop policy if exists "tv_delete_coach" on public.test_variables;
create policy "tv_delete_coach" on public.test_variables
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
  );
