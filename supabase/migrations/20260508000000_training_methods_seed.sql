-- ── Seed méthodes officielles ───────────────────────────────────────────────
-- is_official = true, created_by = NULL
-- Config entièrement paramétrique — aucun nom de méthode encodé dans le code.

INSERT INTO training_methods (id, name, description, scope, category, config, is_official, created_by, tags) VALUES

-- ── SCOPE SET ─────────────────────────────────────────────────────────────────

-- Cluster
(
  'a1000000-0000-0000-0000-000000000001',
  'Cluster',
  'Pauses courtes entre chaque répétition au sein d''une même série. Permet d''utiliser des charges supérieures à la normale en récupérant le système nerveux entre les reps.',
  'set',
  'intensification',
  '{
    "scope": "set",
    "sub_sets": {
      "count": { "type": "fixed", "value": 4 },
      "reps":  { "type": "fixed", "value": 2 },
      "rest_intra": { "type": "fixed", "seconds": 15 }
    },
    "load": { "type": "same" },
    "rir_required": false
  }',
  true, NULL,
  ARRAY['force', 'neurologique', 'séries groupées']
),

-- Drop Set
(
  'a1000000-0000-0000-0000-000000000002',
  'Drop Set',
  'Séries dégressives enchaînées sans récupération. La charge diminue d''un pourcentage fixe entre chaque sous-série, permettant de prolonger l''effort jusqu''à l''échec musculaire.',
  'set',
  'volume',
  '{
    "scope": "set",
    "sub_sets": {
      "count": { "type": "fixed", "value": 3 },
      "reps":  { "type": "amrap" },
      "rest_intra": { "type": "fixed", "seconds": 5 }
    },
    "load": { "type": "decreasing_pct", "drop_pct": 20 },
    "rir_required": false
  }',
  true, NULL,
  ARRAY['hypertrophie', 'échec', 'pump', 'intensification']
),

-- Rest-Pause
(
  'a1000000-0000-0000-0000-000000000003',
  'Rest-Pause',
  'Séquence d''effort maximal (AMRAP) suivie de courtes pauses pour poursuivre l''effort. Très efficace pour accumuler du volume proche de l''échec en peu de temps.',
  'set',
  'intensification',
  '{
    "scope": "set",
    "sub_sets": {
      "count": { "type": "range", "min": 3, "max": 5 },
      "reps":  { "type": "amrap" },
      "rest_intra": { "type": "fixed", "seconds": 20 }
    },
    "load": { "type": "same" },
    "rir_required": false
  }',
  true, NULL,
  ARRAY['intensification', 'échec', 'densité']
),

-- Myoreps
(
  'a1000000-0000-0000-0000-000000000004',
  'Myoreps',
  'Série d''activation à RIR 1-2, suivie de mini-séries de 5 reps avec 20-25s de récupération. Maximise le temps sous tension proche de l''échec et le recrutement des unités motrices.',
  'set',
  'volume',
  '{
    "scope": "set",
    "sub_sets": {
      "count": { "type": "range", "min": 3, "max": 6 },
      "reps":  { "type": "fixed", "value": 5 },
      "rest_intra": { "type": "fixed", "seconds": 22 }
    },
    "load": { "type": "same" },
    "rir_required": true
  }',
  true, NULL,
  ARRAY['hypertrophie', 'mini-séries', 'haute tension', 'efficacité']
),

-- 21s (3 × 7 reps amplitudes différentes)
(
  'a1000000-0000-0000-0000-000000000005',
  '21s',
  '21 répétitions décomposées en 3 sous-séries de 7 : amplitude basse → amplitude haute → amplitude complète. Cible les différentes zones de tension sur toute l''amplitude articulaire.',
  'set',
  'technique',
  '{
    "scope": "set",
    "sub_sets": {
      "count": { "type": "fixed", "value": 3 },
      "reps":  { "type": "fixed", "value": 7 },
      "rest_intra": { "type": "free" }
    },
    "load": { "type": "same" },
    "rir_required": false
  }',
  true, NULL,
  ARRAY['amplitude', 'technique', 'biceps', 'isolation']
),

-- Bi-set (2 reps, pause, 2 reps, pause — lourd)
(
  'a1000000-0000-0000-0000-000000000006',
  '1.5 rep',
  'Chaque répétition consiste en 1 rep complète + 1 demi-rep au point de tension maximale. Double le temps sous tension à l''angle le plus difficile. Idéal pour les exercices à résistance variable.',
  'set',
  'technique',
  '{
    "scope": "set",
    "sub_sets": {
      "count": { "type": "fixed", "value": 4 },
      "reps":  { "type": "fixed", "value": 6 },
      "rest_intra": { "type": "free" }
    },
    "load": { "type": "same" },
    "rir_required": false
  }',
  true, NULL,
  ARRAY['temps sous tension', 'tension maximale', 'technique']
),

-- Mécanique Drop Set (même poids, changement de prise/position)
(
  'a1000000-0000-0000-0000-000000000007',
  'Drop Set mécanique',
  'La charge reste identique mais la position ou prise change pour faciliter l''exercice à chaque sous-série (ex: curl incliné → curl debout → curl marteau). Prolonge l''effort sans changer les disques.',
  'set',
  'volume',
  '{
    "scope": "set",
    "sub_sets": {
      "count": { "type": "fixed", "value": 3 },
      "reps":  { "type": "amrap" },
      "rest_intra": { "type": "fixed", "seconds": 5 }
    },
    "load": { "type": "same" },
    "rir_required": false
  }',
  true, NULL,
  ARRAY['mécanique', 'prise', 'position', 'volume']
),

-- ── SCOPE EXERCISE ────────────────────────────────────────────────────────────

-- Pyramide montante
(
  'a1000000-0000-0000-0000-000000000008',
  'Pyramide montante',
  'La charge augmente de série en série tandis que les répétitions diminuent. Permet un échauffement progressif et un pic d''intensité sur la dernière série.',
  'exercise',
  'intensification',
  '{
    "scope": "exercise",
    "sets": { "count": 4 },
    "reps": { "type": "descending", "pattern": [10, 8, 6, 4] },
    "rest_between": { "type": "fixed", "seconds": 120 },
    "load": { "type": "ascending" },
    "rir_required": false
  }',
  true, NULL,
  ARRAY['force', 'progression', 'classique']
),

-- Pyramide descendante
(
  'a1000000-0000-0000-0000-000000000009',
  'Pyramide descendante',
  'On commence lourd avec peu de reps, puis la charge diminue et les répétitions augmentent. Fatigue progressive du muscle sur toutes les zones de répétitions.',
  'exercise',
  'volume',
  '{
    "scope": "exercise",
    "sets": { "count": 4 },
    "reps": { "type": "ascending", "pattern": [4, 6, 8, 10] },
    "rest_between": { "type": "fixed", "seconds": 120 },
    "load": { "type": "descending" },
    "rir_required": false
  }',
  true, NULL,
  ARRAY['volume', 'classique', 'accumulation']
),

-- Séries constantes (volume classique)
(
  'a1000000-0000-0000-0000-000000000010',
  'Volume constant',
  'Nombre de séries et répétitions identiques sur toutes les séries. Méthode de référence pour l''hypertrophie et le suivi de progression sur le long terme.',
  'exercise',
  'volume',
  '{
    "scope": "exercise",
    "sets": { "count": 4 },
    "reps": { "type": "fixed", "value": 8 },
    "rest_between": { "type": "fixed", "seconds": 90 },
    "load": { "type": "same" },
    "rir_required": true
  }',
  true, NULL,
  ARRAY['hypertrophie', 'standard', 'progression', 'rir']
),

-- AMRAP
(
  'a1000000-0000-0000-0000-000000000011',
  'AMRAP',
  'As Many Reps As Possible — effort maximal jusqu''à l''échec technique ou musculaire sur une ou plusieurs séries. Utilisé pour les tests de force-endurance ou pour maximiser le volume en fin de séance.',
  'exercise',
  'endurance',
  '{
    "scope": "exercise",
    "sets": { "count": 1 },
    "reps": { "type": "custom", "pattern": [] },
    "rest_between": { "type": "free" },
    "load": { "type": "same" },
    "rir_required": false
  }',
  true, NULL,
  ARRAY['échec', 'test', 'endurance de force', 'max']
),

-- 5×5 (force)
(
  'a1000000-0000-0000-0000-000000000012',
  '5×5',
  'Cinq séries de cinq répétitions à charge fixe ou légèrement progressive. Protocole classique de développement de la force neuromusculaire avec récupération complète.',
  'exercise',
  'intensification',
  '{
    "scope": "exercise",
    "sets": { "count": 5 },
    "reps": { "type": "fixed", "value": 5 },
    "rest_between": { "type": "variable", "min_s": 180, "max_s": 300 },
    "load": { "type": "same" },
    "rir_required": true
  }',
  true, NULL,
  ARRAY['force', 'neurologique', 'classique', '5x5']
),

-- Tempo training
(
  'a1000000-0000-0000-0000-000000000013',
  'Tempo contrôlé',
  'Chaque répétition suit un tempo strict (excentrique long / pause / concentrique). Augmente le temps sous tension et améliore le contrôle moteur et la connexion neuromusculaire.',
  'exercise',
  'technique',
  '{
    "scope": "exercise",
    "sets": { "count": 4 },
    "reps": { "type": "fixed", "value": 8 },
    "rest_between": { "type": "fixed", "seconds": 90 },
    "load": { "type": "same" },
    "tempo": { "eccentric_s": 3, "pause_s": 1, "concentric_s": 2 },
    "rir_required": false
  }',
  true, NULL,
  ARRAY['tempo', 'technique', 'excentrique', 'contrôle']
),

-- Ondes de choc (wave loading)
(
  'a1000000-0000-0000-0000-000000000014',
  'Vagues de charge',
  'Pattern de séries en vagues alternant intensité haute et basse (ex: 3,2,1 puis 3,2,1 avec charge légèrement supérieure). Exploite la potentiation post-activation entre les vagues.',
  'exercise',
  'intensification',
  '{
    "scope": "exercise",
    "sets": { "count": 6 },
    "reps": { "type": "custom", "pattern": [3, 2, 1, 3, 2, 1] },
    "rest_between": { "type": "variable", "min_s": 180, "max_s": 240 },
    "load": { "type": "ascending" },
    "rir_required": false
  }',
  true, NULL,
  ARRAY['vagues', 'potentiation', 'force', 'neurologique']
)

ON CONFLICT (id) DO NOTHING;
