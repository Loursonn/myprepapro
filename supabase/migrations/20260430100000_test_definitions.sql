-- Migration: système de tests énergétiques structurés + presets + seed + data migration
-- 2026-04-30

-- ── 1. Nouvelles tables ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.test_definitions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  kind        text        NOT NULL DEFAULT 'custom' CHECK (kind IN ('preset', 'custom')),
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_global   boolean     NOT NULL DEFAULT false,
  description text,
  protocol    jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_variables (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  test_definition_id uuid        NOT NULL REFERENCES public.test_definitions(id) ON DELETE CASCADE,
  key                text        NOT NULL,
  label              text        NOT NULL,
  unit               text        NOT NULL,
  value_type         text        NOT NULL DEFAULT 'number' CHECK (value_type IN ('number', 'pace', 'duration')),
  better_when        text        NOT NULL DEFAULT 'higher' CHECK (better_when IN ('higher', 'lower')),
  created_at         timestamptz DEFAULT now(),
  UNIQUE(test_definition_id, key)
);

CREATE TABLE IF NOT EXISTS public.athlete_test_results (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  test_definition_id uuid        NOT NULL REFERENCES public.test_definitions(id),
  performed_at       date        NOT NULL DEFAULT CURRENT_DATE,
  notes              text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.athlete_test_values (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id   uuid    NOT NULL REFERENCES public.athlete_test_results(id) ON DELETE CASCADE,
  variable_id uuid    NOT NULL REFERENCES public.test_variables(id) ON DELETE RESTRICT,
  value       numeric NOT NULL,
  UNIQUE(result_id, variable_id)
);

-- ── 2. Vue : valeurs courantes par athlète et par variable ────────────────────
-- Sémantique : best = MAX si better_when='higher', MIN si better_when='lower'
-- security_invoker = true : hérite le contexte RLS de l'appelant

CREATE OR REPLACE VIEW public.athlete_current_values
WITH (security_invoker = true) AS
WITH ranked AS (
  SELECT
    atr.athlete_id,
    tv.id          AS variable_id,
    tv.key,
    tv.label,
    tv.unit,
    tv.value_type,
    tv.better_when,
    atv.value,
    atr.performed_at,
    ROW_NUMBER() OVER (
      PARTITION BY atr.athlete_id, tv.id
      ORDER BY
        CASE WHEN tv.better_when = 'higher' THEN  atv.value END DESC NULLS LAST,
        CASE WHEN tv.better_when = 'lower'  THEN -atv.value END DESC NULLS LAST,
        atr.performed_at DESC
    ) AS rn
  FROM public.athlete_test_values atv
  JOIN public.athlete_test_results atr ON atr.id = atv.result_id
  JOIN public.test_variables        tv  ON tv.id  = atv.variable_id
)
SELECT
  athlete_id,
  variable_id,
  key,
  label,
  unit,
  value_type,
  better_when,
  value        AS current_value,
  performed_at AS best_performed_at
FROM ranked
WHERE rn = 1;

-- ── 3. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tv_def         ON public.test_variables(test_definition_id);
CREATE INDEX IF NOT EXISTS idx_atr_athlete    ON public.athlete_test_results(athlete_id);
CREATE INDEX IF NOT EXISTS idx_atr_test       ON public.athlete_test_results(test_definition_id);
CREATE INDEX IF NOT EXISTS idx_atr_date       ON public.athlete_test_results(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_atv_result     ON public.athlete_test_values(result_id);
CREATE INDEX IF NOT EXISTS idx_atv_variable   ON public.athlete_test_values(variable_id);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────

-- test_definitions : lecture ouverte à tous les authentifiés
--                    écriture réservée au créateur ou admin
ALTER TABLE public.test_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "td_select" ON public.test_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "td_insert" ON public.test_definitions
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "td_update" ON public.test_definitions
  FOR UPDATE USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "td_delete" ON public.test_definitions
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- test_variables : lecture ouverte, écriture = créateur du test parent ou admin
ALTER TABLE public.test_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tv_select" ON public.test_variables
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tv_insert" ON public.test_variables
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.test_definitions td
      WHERE td.id = test_definition_id
        AND (
          td.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    )
  );

CREATE POLICY "tv_update" ON public.test_variables
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.test_definitions td
      WHERE td.id = test_definition_id
        AND (
          td.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    )
  );

CREATE POLICY "tv_delete" ON public.test_variables
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.test_definitions td
      WHERE td.id = test_definition_id
        AND (
          td.created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    )
  );

-- athlete_test_results : athlète ses propres, coach ses athlètes (is_coach_of), admin tout
ALTER TABLE public.athlete_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atr_select" ON public.athlete_test_results
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR public.is_coach_of(athlete_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "atr_insert" ON public.athlete_test_results
  FOR INSERT WITH CHECK (
    public.is_coach_of(athlete_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "atr_update" ON public.athlete_test_results
  FOR UPDATE USING (
    public.is_coach_of(athlete_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "atr_delete" ON public.athlete_test_results
  FOR DELETE USING (
    public.is_coach_of(athlete_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- athlete_test_values : dérivé de athlete_test_results via sous-select
ALTER TABLE public.athlete_test_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atv_select" ON public.athlete_test_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.athlete_test_results r
      WHERE r.id = result_id
        AND (
          r.athlete_id = auth.uid()
          OR public.is_coach_of(r.athlete_id)
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    )
  );

CREATE POLICY "atv_insert" ON public.athlete_test_values
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.athlete_test_results r
      WHERE r.id = result_id
        AND (
          public.is_coach_of(r.athlete_id)
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    )
  );

CREATE POLICY "atv_update" ON public.athlete_test_values
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.athlete_test_results r
      WHERE r.id = result_id
        AND (
          public.is_coach_of(r.athlete_id)
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    )
  );

CREATE POLICY "atv_delete" ON public.athlete_test_values
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.athlete_test_results r
      WHERE r.id = result_id
        AND (
          public.is_coach_of(r.athlete_id)
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
        )
    )
  );

-- ── 5. Seed presets (idempotent via IDs fixes) ───────────────────────────────

INSERT INTO public.test_definitions (id, name, kind, is_global, description)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'VMA — Vitesse Maximale Aérobie', 'preset', true,
   'Vitesse à laquelle le VO2max est atteint. Protocoles courants : Vameval, Léger-Boucher, VAM-EVAL.'),
  ('00000000-0000-0000-0000-000000000002',
   'VC — Vitesse Critique', 'preset', true,
   'Vitesse maximale soutenable sur longue durée sans accumulation lactate. Prédictive des performances 10–60 min.'),
  ('00000000-0000-0000-0000-000000000003',
   'FE — Facteur d''Endurance', 'preset', true,
   'Ratio VC/VMA × 100. Interprétation : >85% excellent, 80–85% bon, <80% à améliorer.'),
  ('00000000-0000-0000-0000-000000000004',
   'VO2max', 'preset', true,
   'Consommation maximale d''oxygène. Mesure directe (spiromètre) ou estimée (Léger, Cooper, etc.).'),
  ('00000000-0000-0000-0000-000000000005',
   'FCmax — Fréquence Cardiaque Max', 'preset', true,
   'FC maximale jamais atteinte. S''actualise automatiquement : la valeur courante = la plus haute jamais enregistrée.'),
  ('00000000-0000-0000-0000-000000000006',
   'SV1 — Seuil Ventilatoire 1', 'preset', true,
   'Vitesse au premier seuil ventilatoire. Correspond à la zone 2, début de l''hyperventilation compensatoire.'),
  ('00000000-0000-0000-0000-000000000007',
   'Seuil Anaérobie (SV2)', 'preset', true,
   'Vitesse au second seuil ventilatoire (seuil lactate ≈ 4 mmol/L). Correspond à la zone 4.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.test_variables (test_definition_id, key, label, unit, value_type, better_when)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'vma',    'VMA',    'km/h',      'number', 'higher'),
  ('00000000-0000-0000-0000-000000000002', 'vc',     'VC',     'km/h',      'number', 'higher'),
  ('00000000-0000-0000-0000-000000000003', 'fe',     'FE',     '%',         'number', 'higher'),
  ('00000000-0000-0000-0000-000000000004', 'vo2max', 'VO2max', 'mL/kg/min', 'number', 'higher'),
  ('00000000-0000-0000-0000-000000000005', 'fc_max', 'FCmax',  'bpm',       'number', 'higher'),
  ('00000000-0000-0000-0000-000000000006', 'sv1',    'SV1',    'km/h',      'number', 'higher'),
  ('00000000-0000-0000-0000-000000000007', 'sv2',    'SV2',    'km/h',      'number', 'higher')
ON CONFLICT (test_definition_id, key) DO NOTHING;

-- ── 6. Migration données historiques : test_sessions → nouveau modèle ────────
-- Idempotente : vérifie l'existence avant d'insérer

DO $$
DECLARE
  ts           RECORD;
  td_id        uuid;
  tv_id        uuid;
  tr_id        uuid;
  metric       jsonb;
  metrics_arr  jsonb;
  metric_key   text;
  metric_val   numeric;
  real_coach   uuid;  -- vrai coach de l'athlète (profiles.coach_id)
BEGIN
  -- Itérer sur chaque test complété avec des métriques
  FOR ts IN
    SELECT *
    FROM public.test_sessions
    WHERE completed = true
      AND results_structured IS NOT NULL
      AND results_structured != '{}'::jsonb
      AND results_structured ? 'metrics'
      AND jsonb_array_length(results_structured->'metrics') > 0
  LOOP
    metrics_arr := ts.results_structured->'metrics';

    -- Correction du bug UI : coach_id dans test_sessions était rempli avec
    -- l'athlete_id au lieu de l'ID réel du coach. On lit le vrai coach depuis profiles.
    SELECT p.coach_id INTO real_coach
    FROM public.profiles p
    WHERE p.id = ts.athlete_id;
    -- Si l'athlète n'a pas de coach assigné, created_by = NULL (test orphelin)

    -- Trouver ou créer un test_definition pour ce titre + vrai créateur
    SELECT id INTO td_id
    FROM public.test_definitions
    WHERE name = ts.title
      AND kind = 'custom'
      AND created_by IS NOT DISTINCT FROM real_coach;

    IF td_id IS NULL THEN
      INSERT INTO public.test_definitions (name, kind, created_by, is_global, description)
      VALUES (
        ts.title,
        'custom',
        real_coach,   -- ID du vrai coach, ou NULL si orphelin
        false,
        ts.description
      )
      RETURNING id INTO td_id;
    END IF;

    -- Créer les variables manquantes
    FOR metric IN SELECT * FROM jsonb_array_elements(metrics_arr) LOOP
      CONTINUE WHEN metric->>'name' IS NULL OR trim(metric->>'name') = '';
      metric_key := lower(regexp_replace(trim(metric->>'name'), '[^a-zA-Z0-9]+', '_', 'g'));
      CONTINUE WHEN metric_key = '';

      INSERT INTO public.test_variables (test_definition_id, key, label, unit, value_type, better_when)
      VALUES (
        td_id,
        metric_key,
        metric->>'name',
        COALESCE(NULLIF(trim(COALESCE(metric->>'unit', '')), ''), 'custom'),
        'number',
        'higher'
      )
      ON CONFLICT (test_definition_id, key) DO NOTHING;
    END LOOP;

    -- Créer le résultat si pas déjà migré
    IF NOT EXISTS (
      SELECT 1 FROM public.athlete_test_results
      WHERE athlete_id = ts.athlete_id
        AND test_definition_id = td_id
        AND performed_at = ts.date
    ) THEN
      INSERT INTO public.athlete_test_results (athlete_id, test_definition_id, performed_at, notes)
      VALUES (ts.athlete_id, td_id, ts.date, ts.results_note)
      RETURNING id INTO tr_id;

      -- Créer les valeurs
      FOR metric IN SELECT * FROM jsonb_array_elements(metrics_arr) LOOP
        CONTINUE WHEN metric->>'name' IS NULL OR trim(metric->>'name') = '';
        metric_key := lower(regexp_replace(trim(metric->>'name'), '[^a-zA-Z0-9]+', '_', 'g'));
        CONTINUE WHEN metric_key = '';

        BEGIN
          metric_val := (metric->>'value')::numeric;
        EXCEPTION WHEN OTHERS THEN
          CONTINUE;
        END;

        SELECT id INTO tv_id
        FROM public.test_variables
        WHERE test_definition_id = td_id AND key = metric_key;

        IF tv_id IS NOT NULL THEN
          INSERT INTO public.athlete_test_values (result_id, variable_id, value)
          VALUES (tr_id, tv_id, metric_val)
          ON CONFLICT (result_id, variable_id) DO NOTHING;
        END IF;
      END LOOP;
    END IF;

  END LOOP;
END;
$$;
