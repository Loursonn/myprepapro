-- Ajout de la date de naissance sur le profil athlète
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE;
