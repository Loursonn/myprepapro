-- Ajout du tri personnalisé sur les habitudes
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS sort_order integer;
