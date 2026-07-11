-- Add left/right columns for bilateral limb measurements
ALTER TABLE public.measurement_logs
  ADD COLUMN IF NOT EXISTS bras_g   NUMERIC(5,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bras_d   NUMERIC(5,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cuisse_g NUMERIC(5,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cuisse_d NUMERIC(5,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mollet_g NUMERIC(5,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mollet_d NUMERIC(5,1) DEFAULT NULL;

COMMENT ON COLUMN public.measurement_logs.bras_g IS 'Bras gauche (cm)';
COMMENT ON COLUMN public.measurement_logs.bras_d IS 'Bras droit (cm)';
COMMENT ON COLUMN public.measurement_logs.cuisse_g IS 'Cuisse gauche (cm)';
COMMENT ON COLUMN public.measurement_logs.cuisse_d IS 'Cuisse droite (cm)';
COMMENT ON COLUMN public.measurement_logs.mollet_g IS 'Mollet gauche (cm)';
COMMENT ON COLUMN public.measurement_logs.mollet_d IS 'Mollet droit (cm)';
