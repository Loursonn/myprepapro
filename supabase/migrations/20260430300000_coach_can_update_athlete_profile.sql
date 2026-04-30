-- Permet à un coach de modifier le profil de ses athlètes
DROP POLICY IF EXISTS "coaches_can_update_athlete_profiles" ON profiles;
CREATE POLICY "coaches_can_update_athlete_profiles"
ON profiles
FOR UPDATE
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());
