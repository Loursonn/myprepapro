-- ============================================================
-- Migration : Triggers anti-chevauchement pour périodes de même type
-- Règle : deux macrocycles / mesocycles / cycles / microcycles
--         du même parent (ou du même athlète pour macro) ne peuvent
--         jamais se chevaucher.
-- Chevauchement = start_date <= other.end_date AND end_date >= other.start_date
-- 2026-05-10
-- ============================================================

-- ── 1. MACROCYCLES — même athlète ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_macrocycle_overlap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.macrocycles
    WHERE id         != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND athlete_id  = NEW.athlete_id
      AND start_date <= NEW.end_date
      AND end_date   >= NEW.start_date
  ) THEN
    RAISE EXCEPTION
      'Chevauchement : ce macrocycle chevauche un macrocycle existant pour cet athlète (% → %)',
      NEW.start_date, NEW.end_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_macrocycle_overlap ON public.macrocycles;
CREATE TRIGGER prevent_macrocycle_overlap
  BEFORE INSERT OR UPDATE ON public.macrocycles
  FOR EACH ROW EXECUTE FUNCTION public.check_macrocycle_overlap();

-- ── 2. MESOCYCLES — même macrocycle_id ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_mesocycle_overlap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.mesocycles
    WHERE id            != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND macrocycle_id  = NEW.macrocycle_id
      AND start_date    <= NEW.end_date
      AND end_date      >= NEW.start_date
  ) THEN
    RAISE EXCEPTION
      'Chevauchement : ce mésocycle chevauche un mésocycle existant dans ce macrocycle (% → %)',
      NEW.start_date, NEW.end_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_mesocycle_overlap ON public.mesocycles;
CREATE TRIGGER prevent_mesocycle_overlap
  BEFORE INSERT OR UPDATE ON public.mesocycles
  FOR EACH ROW EXECUTE FUNCTION public.check_mesocycle_overlap();

-- ── 3. CYCLES — même mesocycle_id (seulement si mesocycle_id non null) ────────

CREATE OR REPLACE FUNCTION public.check_cycle_overlap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Cycles standalone (mesocycle_id IS NULL) : pas de contrainte entre eux
  IF NEW.mesocycle_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cycles
    WHERE id          != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND mesocycle_id = NEW.mesocycle_id
      AND start_date  <= NEW.end_date
      AND end_date    >= NEW.start_date
  ) THEN
    RAISE EXCEPTION
      'Chevauchement : ce cycle chevauche un cycle existant dans ce mésocycle (% → %)',
      NEW.start_date, NEW.end_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_cycle_overlap ON public.cycles;
CREATE TRIGGER prevent_cycle_overlap
  BEFORE INSERT OR UPDATE ON public.cycles
  FOR EACH ROW EXECUTE FUNCTION public.check_cycle_overlap();

-- ── 4. MICROCYCLES — même cycle_id ────────────────────────────────────────────
-- Remplace check_microcycle_dates (containment) + ajoute overlap inter-siblings

CREATE OR REPLACE FUNCTION public.check_microcycle_dates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cyc RECORD;
BEGIN
  SELECT start_date, end_date INTO cyc
    FROM public.cycles WHERE id = NEW.cycle_id;

  -- Bloquer seulement si zéro chevauchement avec le cycle parent
  IF NEW.end_date < cyc.start_date OR NEW.start_date > cyc.end_date THEN
    RAISE EXCEPTION
      'Microcycle semaine % (% → %) sans chevauchement avec le cycle parent (% → %)',
      NEW.week_number, NEW.start_date, NEW.end_date, cyc.start_date, cyc.end_date;
  END IF;

  -- Bloquer chevauchement entre microcycles du même cycle
  IF EXISTS (
    SELECT 1 FROM public.microcycles
    WHERE id       != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND cycle_id  = NEW.cycle_id
      AND start_date <= NEW.end_date
      AND end_date   >= NEW.start_date
  ) THEN
    RAISE EXCEPTION
      'Chevauchement : microcycle semaine % (% → %) chevauche un microcycle existant dans ce cycle',
      NEW.week_number, NEW.start_date, NEW.end_date;
  END IF;

  RETURN NEW;
END;
$$;

-- Le trigger validate_microcycle_dates existe déjà → il appelle check_microcycle_dates()
-- La fonction est mise à jour ci-dessus, pas besoin de recréer le trigger.
-- Sécurité : s'assurer qu'il existe
DROP TRIGGER IF EXISTS validate_microcycle_dates ON public.microcycles;
CREATE TRIGGER validate_microcycle_dates
  BEFORE INSERT OR UPDATE ON public.microcycles
  FOR EACH ROW EXECUTE FUNCTION public.check_microcycle_dates();

NOTIFY pgrst, 'reload schema';
