-- Catégorisation des tests + 5 presets (1 par catégorie)
-- Catégories : bilan_articulaire / endurance / force / explosivite / vitesse

alter table public.test_definitions add column if not exists category text;

-- ── Définitions (idempotent via IDs fixes) ────────────────────────────────────

insert into public.test_definitions (id, name, kind, is_global, category, description, protocol)
values
  ('00000000-0000-0000-0000-0000000000a1',
   'Rotation externe de hanche', 'preset', true, 'bilan_articulaire',
   'Amplitude de rotation externe de hanche (mobilité), mesurée des deux côtés.',
   jsonb_build_object('text', 'Allongé sur le dos, hanche et genou fléchis à 90°. Mesurer l''angle de rotation externe au goniomètre, à droite puis à gauche.')),

  ('00000000-0000-0000-0000-0000000000a2',
   'Demi-Cooper', 'preset', true, 'endurance',
   'Distance maximale parcourue en 6 minutes de course continue.',
   jsonb_build_object('text', 'Courir la plus grande distance possible en 6 min sur un parcours mesuré. Relever la distance en mètres.')),

  ('00000000-0000-0000-0000-0000000000a3',
   '5RM Squat', 'preset', true, 'force',
   'Charge maximale soulevée sur 5 répétitions complètes au squat.',
   jsonb_build_object('text', 'Après échauffement progressif, déterminer la charge maximale permettant exactement 5 répétitions avec une technique correcte.')),

  ('00000000-0000-0000-0000-0000000000a4',
   'Squat Jump', 'preset', true, 'explosivite',
   'Hauteur de saut vertical en départ statique, sans contre-mouvement.',
   jsonb_build_object('text', 'Mains aux hanches, position semi-fléchie (~90°) maintenue 2 s, puis saut maximal sans contre-mouvement. Mesurer la hauteur.')),

  ('00000000-0000-0000-0000-0000000000a5',
   '30m départ arrêté', 'preset', true, 'vitesse',
   'Temps réalisé sur 30 mètres, départ arrêté.',
   jsonb_build_object('text', 'Départ arrêté derrière la ligne, sprint maximal sur 30 m. Chronométrer (cellules si possible), retenir le meilleur essai.'))
on conflict (id) do nothing;

-- ── Variables mesurées ────────────────────────────────────────────────────────

insert into public.test_variables (test_definition_id, key, label, unit, value_type, better_when)
values
  ('00000000-0000-0000-0000-0000000000a1', 'amplitude_d', 'Droite',   '°',  'number', 'higher'),
  ('00000000-0000-0000-0000-0000000000a1', 'amplitude_g', 'Gauche',   '°',  'number', 'higher'),
  ('00000000-0000-0000-0000-0000000000a2', 'distance',    'Distance', 'm',  'number', 'higher'),
  ('00000000-0000-0000-0000-0000000000a3', 'charge',      'Charge',   'kg', 'number', 'higher'),
  ('00000000-0000-0000-0000-0000000000a4', 'hauteur',     'Hauteur',  'cm', 'number', 'higher'),
  ('00000000-0000-0000-0000-0000000000a5', 'temps',       'Temps',    's',  'number', 'lower')
on conflict (test_definition_id, key) do nothing;
