-- Quand un résultat de test est saisi pour une variable extrapolée vers une valeur
-- physiologique (VMA, Vmax…), la référence active correspondante dans performance_logs
-- se met à jour automatiquement (= la VMA affichée dans le Profil sportif).

create or replace function public.sync_extrap_to_performance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_metric  text;
  v_op      text;
  v_factor  numeric;
  v_unit    text;
  v_athlete uuid;
  v_date    date;
  physio    numeric;
begin
  select extrap_metric, extrap_op, extrap_factor
    into v_metric, v_op, v_factor
  from public.test_variables where id = NEW.variable_id;

  if v_metric is null or v_op is null or v_factor is null or v_factor = 0 then
    return NEW;
  end if;

  select athlete_id, performed_at into v_athlete, v_date
  from public.athlete_test_results where id = NEW.result_id;
  if v_athlete is null then return NEW; end if;

  -- Ne pas écraser une référence active plus récente
  if exists (
    select 1 from public.performance_logs
    where athlete_id = v_athlete and metric_name = v_metric
      and is_active_reference = true and date > v_date
  ) then
    return NEW;
  end if;

  physio := round((case when v_op = 'div' then NEW.value / v_factor else NEW.value * v_factor end)::numeric, 1);

  v_unit := case v_metric
    when 'VMA' then 'km/h' when 'Vmax' then 'km/h' when 'VC' then 'km/h'
    when 'VO2max' then 'mL/kg/min' when 'PMA' then 'W' when 'FTP' then 'W'
    when 'FCmax' then 'bpm' else '' end;

  update public.performance_logs set is_active_reference = false
  where athlete_id = v_athlete and metric_name = v_metric and is_active_reference = true;

  insert into public.performance_logs
    (athlete_id, metric_type, metric_name, value, unit, date, is_active_reference, coach_validated)
  values
    (v_athlete, 'reference', v_metric, physio, v_unit, v_date, true, true);

  return NEW;
end;
$$;

drop trigger if exists trg_sync_extrap_perf on public.athlete_test_values;
create trigger trg_sync_extrap_perf
  after insert or update on public.athlete_test_values
  for each row execute function public.sync_extrap_to_performance();
