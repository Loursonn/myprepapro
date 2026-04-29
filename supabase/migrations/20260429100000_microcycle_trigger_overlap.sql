-- Fix: relax microcycle date check from containment to overlap.
-- Auto-generated microcycles are ISO-week aligned (Mon→Sun) and may start
-- before or end after the parent cycle's exact dates.

CREATE OR REPLACE FUNCTION public.check_microcycle_dates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cyc RECORD;
BEGIN
  SELECT start_date, end_date INTO cyc
    FROM public.cycles WHERE id = NEW.cycle_id;

  -- Only block microcycles that have zero overlap with the cycle.
  IF NEW.end_date < cyc.start_date OR NEW.start_date > cyc.end_date THEN
    RAISE EXCEPTION
      'Microcycle semaine % (% → %) sans chevauchement avec le cycle (% → %)',
      NEW.week_number, NEW.start_date, NEW.end_date, cyc.start_date, cyc.end_date;
  END IF;

  RETURN NEW;
END;
$$;
