-- Fix: allow any authenticated user to read coach profiles (needed for coach_code lookup)
-- Without this policy, linkToCoach() always returns "Code coach invalide" because
-- the athlete can't SELECT a coach profile they don't already belong to.

CREATE POLICY "profiles_select_coaches"
ON public.profiles
FOR SELECT
USING (role IN ('coach', 'coach_athlete'));
