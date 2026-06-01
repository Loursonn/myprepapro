-- Pont : un test programmé (test_sessions) complété → alimente le système
-- valeurs objectives (athlete_test_results / athlete_test_values),
-- lu par le panneau Tests du Profil Sportif (valeurs courantes / historique / comparaison).
--
-- SECURITY DEFINER : contourne la RLS (l'athlète n'a pas le droit d'insérer
-- directement dans athlete_test_results).

create or replace function public.sync_test_session_to_results()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  def_id uuid;
  res_id uuid;
  tv_id  uuid;
  v_key  text;
  v_val  numeric;
  vars   jsonb;
begin
  -- Seulement quand le test est complété avec des variables structurées
  if NEW.completed is not true then
    return NEW;
  end if;

  vars := NEW.results_structured -> 'variables';
  if vars is null or jsonb_typeof(vars) <> 'object' then
    return NEW;
  end if;

  -- Définition correspondante par titre (preset global prioritaire, sinon custom)
  select id into def_id
  from public.test_definitions
  where lower(name) = lower(NEW.title)
  order by (case when is_global then 0 else 1 end), created_at
  limit 1;

  if def_id is null then
    return NEW;
  end if;

  -- Dédoublonnage : on remplace le résultat existant pour (athlète, test, date)
  delete from public.athlete_test_results
  where athlete_id = NEW.athlete_id
    and test_definition_id = def_id
    and performed_at = NEW.date;

  -- Au moins une valeur numérique exploitable ?
  if not exists (
    select 1 from jsonb_each_text(vars) e
    where e.value ~ '^-?[0-9]+(\.[0-9]+)?$'
  ) then
    return NEW;
  end if;

  insert into public.athlete_test_results (athlete_id, test_definition_id, performed_at, notes)
  values (NEW.athlete_id, def_id, NEW.date, NEW.results_note)
  returning id into res_id;

  for v_key, v_val in
    select e.key, e.value::numeric
    from jsonb_each_text(vars) e
    where e.value ~ '^-?[0-9]+(\.[0-9]+)?$'
  loop
    select id into tv_id
    from public.test_variables
    where test_definition_id = def_id and key = v_key;

    if tv_id is not null then
      insert into public.athlete_test_values (result_id, variable_id, value)
      values (res_id, tv_id, v_val)
      on conflict (result_id, variable_id) do update set value = excluded.value;
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_test_session on public.test_sessions;
create trigger trg_sync_test_session
  after insert or update on public.test_sessions
  for each row execute function public.sync_test_session_to_results();
