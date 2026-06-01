-- Tests par articulation (bilan articulaire) + média explicatif sur les tests.

alter table public.test_definitions add column if not exists articulation text;
alter table public.test_definitions add column if not exists media_url   text;

-- Ancien preset générique remplacé par le set par articulation
delete from public.athlete_test_results where test_definition_id = '00000000-0000-0000-0000-0000000000a1';
delete from public.test_definitions      where id                = '00000000-0000-0000-0000-0000000000a1';

-- 18 tests articulaires (note /5, remplis par le coach via vidéo)
insert into public.test_definitions (id, name, kind, is_global, category, articulation, fill_mode) values
  ('00000000-0000-0000-0000-000000000b01','Épaule — Rotation interne',  'preset',true,'bilan_articulaire','Épaule',  'coach'),
  ('00000000-0000-0000-0000-000000000b02','Épaule — Rotation externe',  'preset',true,'bilan_articulaire','Épaule',  'coach'),
  ('00000000-0000-0000-0000-000000000b03','Épaule — Abduction R3',      'preset',true,'bilan_articulaire','Épaule',  'coach'),
  ('00000000-0000-0000-0000-000000000b04','Épaule — Flexion',           'preset',true,'bilan_articulaire','Épaule',  'coach'),
  ('00000000-0000-0000-0000-000000000b05','Épaule — Extension',         'preset',true,'bilan_articulaire','Épaule',  'coach'),
  ('00000000-0000-0000-0000-000000000b06','Hanche — Rotation externe',  'preset',true,'bilan_articulaire','Hanche',  'coach'),
  ('00000000-0000-0000-0000-000000000b07','Hanche — Rotation interne',  'preset',true,'bilan_articulaire','Hanche',  'coach'),
  ('00000000-0000-0000-0000-000000000b08','Hanche — Flexion',           'preset',true,'bilan_articulaire','Hanche',  'coach'),
  ('00000000-0000-0000-0000-000000000b09','Hanche — Extension',         'preset',true,'bilan_articulaire','Hanche',  'coach'),
  ('00000000-0000-0000-0000-000000000b10','Hanche — Abduction',         'preset',true,'bilan_articulaire','Hanche',  'coach'),
  ('00000000-0000-0000-0000-000000000b11','Genou — Rotation externe',   'preset',true,'bilan_articulaire','Genou',   'coach'),
  ('00000000-0000-0000-0000-000000000b12','Genou — Rotation interne',   'preset',true,'bilan_articulaire','Genou',   'coach'),
  ('00000000-0000-0000-0000-000000000b13','Genou — Flexion',            'preset',true,'bilan_articulaire','Genou',   'coach'),
  ('00000000-0000-0000-0000-000000000b14','Genou — Extension',          'preset',true,'bilan_articulaire','Genou',   'coach'),
  ('00000000-0000-0000-0000-000000000b15','Cheville — Flexion dorsale', 'preset',true,'bilan_articulaire','Cheville','coach'),
  ('00000000-0000-0000-0000-000000000b16','Cheville — Flexion plantaire','preset',true,'bilan_articulaire','Cheville','coach'),
  ('00000000-0000-0000-0000-000000000b17','Cheville — Éversion',        'preset',true,'bilan_articulaire','Cheville','coach'),
  ('00000000-0000-0000-0000-000000000b18','Cheville — Inversion',       'preset',true,'bilan_articulaire','Cheville','coach')
on conflict (id) do nothing;

insert into public.test_variables (test_definition_id, key, label, unit, value_type, better_when)
select id, 'note', 'Note', '/5', 'scale5', 'higher'
from public.test_definitions
where id between '00000000-0000-0000-0000-000000000b01' and '00000000-0000-0000-0000-000000000b18'
on conflict (test_definition_id, key) do nothing;
