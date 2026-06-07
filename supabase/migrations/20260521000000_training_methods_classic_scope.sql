-- Extend scope CHECK to include 'classic' (séries × plage de reps)
ALTER TABLE public.training_methods
  DROP CONSTRAINT IF EXISTS training_methods_scope_check;

ALTER TABLE public.training_methods
  ADD CONSTRAINT training_methods_scope_check
    CHECK (scope IN ('set', 'exercise', 'classic'));
