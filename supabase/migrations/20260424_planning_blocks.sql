-- Planning architecture: seasons, hierarchical planning blocks, competitions
-- 2026-04-24

-- Seasons: annual planning periods defined by coach
CREATE TABLE IF NOT EXISTS seasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  athlete_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Planning blocks: unlimited hierarchy (macrocycle > mesocycle > microcycle > custom)
CREATE TABLE IF NOT EXISTS planning_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  coach_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  athlete_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL DEFAULT 'custom',
  start_week      INT NOT NULL,
  end_week        INT NOT NULL,
  color           TEXT NOT NULL DEFAULT '#7B6FFF',
  parent_block_id UUID REFERENCES planning_blocks(id) ON DELETE SET NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_week_range CHECK (end_week >= start_week),
  CONSTRAINT valid_week_numbers CHECK (start_week >= 1)
);

-- Competitions: shared entity across all views (prog, stats, etc.)
CREATE TABLE IF NOT EXISTS competitions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  athlete_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  planning_block_id UUID REFERENCES planning_blocks(id) ON DELETE SET NULL,
  season_id         UUID REFERENCES seasons(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'competition',
  date              DATE NOT NULL,
  location          TEXT,
  notes             TEXT,
  priority          TEXT NOT NULL DEFAULT 'A',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link test_sessions to planning blocks (optional)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_sessions' AND column_name = 'planning_block_id'
  ) THEN
    ALTER TABLE test_sessions
      ADD COLUMN planning_block_id UUID REFERENCES planning_blocks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- RLS
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

-- Seasons: coach manages, athlete reads
CREATE POLICY "seasons_select" ON seasons FOR SELECT
  USING (coach_id = auth.uid() OR athlete_id = auth.uid());

CREATE POLICY "seasons_insert" ON seasons FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "seasons_update" ON seasons FOR UPDATE
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

CREATE POLICY "seasons_delete" ON seasons FOR DELETE
  USING (coach_id = auth.uid());

-- Planning blocks: coach manages, athlete reads
CREATE POLICY "planning_blocks_select" ON planning_blocks FOR SELECT
  USING (coach_id = auth.uid() OR athlete_id = auth.uid());

CREATE POLICY "planning_blocks_insert" ON planning_blocks FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "planning_blocks_update" ON planning_blocks FOR UPDATE
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

CREATE POLICY "planning_blocks_delete" ON planning_blocks FOR DELETE
  USING (coach_id = auth.uid());

-- Competitions: coach manages, athlete reads
CREATE POLICY "competitions_select" ON competitions FOR SELECT
  USING (coach_id = auth.uid() OR athlete_id = auth.uid());

CREATE POLICY "competitions_insert" ON competitions FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "competitions_update" ON competitions FOR UPDATE
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

CREATE POLICY "competitions_delete" ON competitions FOR DELETE
  USING (coach_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seasons_athlete ON seasons(athlete_id);
CREATE INDEX IF NOT EXISTS idx_planning_blocks_season ON planning_blocks(season_id);
CREATE INDEX IF NOT EXISTS idx_planning_blocks_parent ON planning_blocks(parent_block_id);
CREATE INDEX IF NOT EXISTS idx_competitions_athlete ON competitions(athlete_id);
CREATE INDEX IF NOT EXISTS idx_competitions_season ON competitions(season_id);
CREATE INDEX IF NOT EXISTS idx_competitions_block ON competitions(planning_block_id);
