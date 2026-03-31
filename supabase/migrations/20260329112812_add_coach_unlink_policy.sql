-- Allow a coach to remove an athlete from their roster (set coach_id to null)
DROP POLICY IF EXISTS "Coach can unlink own athletes" ON profiles;

CREATE POLICY "Coach can unlink own athletes"
ON profiles
FOR UPDATE
USING (coach_id = auth.uid())
WITH CHECK (coach_id IS NULL);
