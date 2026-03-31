-- Add coach_code column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coach_code TEXT UNIQUE;

-- Drop existing policy if it exists (to recreate cleanly)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
