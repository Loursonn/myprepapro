-- Extrapolation d'une variable de test vers une valeur physiologique (VMA, Vmax, PMA…)
-- Formule simple : valeur (op) facteur. Ex. Demi-Cooper distance ÷ 100 = VMA.

alter table public.test_variables add column if not exists extrap_metric text;
alter table public.test_variables add column if not exists extrap_op     text check (extrap_op in ('div', 'mul'));
alter table public.test_variables add column if not exists extrap_factor numeric;

-- Demi-Cooper : distance / 100 → VMA
update public.test_variables
  set extrap_metric = 'VMA', extrap_op = 'div', extrap_factor = 100
  where test_definition_id = '00000000-0000-0000-0000-0000000000a2' and key = 'distance';
