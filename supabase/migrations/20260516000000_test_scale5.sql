-- Nouveau type de valeur : 'scale5' = échelle sur 5 (tests qualitatifs, ex. bilan articulaire)

alter table public.test_variables drop constraint if exists test_variables_value_type_check;
alter table public.test_variables add constraint test_variables_value_type_check
  check (value_type in ('number', 'pace', 'duration', 'scale5'));

-- Rotation externe de hanche : noter sur 5 (au lieu de degrés)
update public.test_variables
  set value_type = 'scale5', unit = '/5'
  where test_definition_id = '00000000-0000-0000-0000-0000000000a1';
