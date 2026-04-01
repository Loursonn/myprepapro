-- Ajout des champs de profil détaillé pour les athlètes
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS body_fat_pct NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS base_metabolism INTEGER;
