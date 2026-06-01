-- Mode de remplissage d'un test :
--   'self'  = l'athlète saisit lui-même les valeurs dans l'app
--   'coach' = le coach remplit/note (l'athlète envoie sa vidéo/photo hors app)

alter table public.test_definitions
  add column if not exists fill_mode text not null default 'self'
  check (fill_mode in ('self', 'coach'));

-- Presets : bilan articulaire, sauts (explosivité), vitesse → remplis par le coach
update public.test_definitions
  set fill_mode = 'coach'
  where id in (
    '00000000-0000-0000-0000-0000000000a1', -- Rotation externe de hanche
    '00000000-0000-0000-0000-0000000000a4', -- Squat Jump
    '00000000-0000-0000-0000-0000000000a5'  -- 30m départ arrêté
  );
