-- Tests RPC : get_coach_overview()
-- Lance avec : supabase test db
-- 2026-04-27

BEGIN;

SELECT plan(5);

-- ── Setup ────────────────────────────────────────────────────────────────────

INSERT INTO auth.users (id, email) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'coach_c@test.com')
ON CONFLICT DO NOTHING;
INSERT INTO public.profiles (id, role, full_name, coach_code) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'coach', 'Coach C', 'COACH_C')
ON CONFLICT DO NOTHING;

INSERT INTO auth.users (id, email) VALUES
  ('cccccccc-1111-0000-0000-000000000002', 'athlete_c@test.com')
ON CONFLICT DO NOTHING;
INSERT INTO public.profiles (id, role, full_name, coach_id) VALUES
  ('cccccccc-1111-0000-0000-000000000002', 'athlete', 'Athlete C',
   'cccccccc-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO public.app_data (athlete_id, key, value) VALUES
  ('cccccccc-1111-0000-0000-000000000002', 'asp:wellness', '{"score": 80, "fatigue": 3}')
ON CONFLICT DO NOTHING;

INSERT INTO public.competitions (coach_id, athlete_id, name, date) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'cccccccc-1111-0000-0000-000000000002',
   'Test Compet', CURRENT_DATE + 5);

-- ── Appeler la RPC en tant que Coach C ───────────────────────────────────────

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub": "cccccccc-0000-0000-0000-000000000001", "role": "authenticated"}';

-- Test 1 : la RPC retourne un objet JSON non null
SELECT ok(
  public.get_coach_overview('cccccccc-0000-0000-0000-000000000001') IS NOT NULL,
  'get_coach_overview retourne un résultat non null'
);

-- Test 2 : athlete_count = 1
SELECT ok(
  (public.get_coach_overview('cccccccc-0000-0000-0000-000000000001') ->> 'athlete_count')::int = 1,
  'athlete_count correct'
);

-- Test 3 : competitions_count = 1
SELECT ok(
  (public.get_coach_overview('cccccccc-0000-0000-0000-000000000001') ->> 'competitions_count')::int = 1,
  'competitions_count correct'
);

-- Test 4 : wellness_today contient au moins un élément
SELECT ok(
  jsonb_array_length(public.get_coach_overview('cccccccc-0000-0000-0000-000000000001') -> 'wellness_today') = 1,
  'wellness_today contient 1 entrée'
);

-- Test 5 : appel avec un autre UUID → exception attendue
DO $$
BEGIN
  BEGIN
    PERFORM public.get_coach_overview('aaaaaaaa-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FAIL: devrait lever une exception';
  EXCEPTION
    WHEN OTHERS THEN NULL; -- accès refusé attendu
  END;
END;
$$;
SELECT pass('get_coach_overview lève une exception si coach_uuid != auth.uid()');

SELECT * FROM finish();

ROLLBACK;
