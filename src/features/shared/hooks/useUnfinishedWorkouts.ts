/**
 * useUnfinishedWorkouts — séances passées contenant des saisies de l'athlète
 * mais jamais clôturées ("Terminer la séance" non cliqué).
 *
 * Les données sont bien enregistrées (autosave), mais tant que le statut reste
 * "planned" la séance n'apparaît ni dans l'historique ni dans les stats.
 * Côté athlète : bandeau de rappel. Côté coach : liste de relance.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AthleteModifications } from "../types/athlete";

export interface UnfinishedWorkout {
  id: string;
  athleteId: string;
  sessionName: string;
  scheduledDate: string;
  /** Nombre de séries réellement renseignées (charge ou reps). */
  loggedSets: number;
}

/** Une séance ne compte comme "à clôturer" que si l'athlète y a saisi quelque chose. */
function countLoggedSets(mods: AthleteModifications | null | undefined): number {
  const sessionSets = mods?.sessionSets;
  if (!sessionSets) return 0;
  return Object.values(sessionSets).reduce(
    (n, rows) => n + (rows ?? []).filter((s) => s && (s.kg != null || s.reps != null)).length,
    0,
  );
}

function todayISO(): string {
  return new Date().toLocaleDateString("sv-SE"); // yyyy-MM-dd, heure locale
}

/**
 * @param athleteIds un ou plusieurs athlètes. Vue athlète : son seul id.
 *                   Vue coach : tous ses athlètes.
 */
export function useUnfinishedWorkouts(athleteIds: string[] | string | null | undefined) {
  const ids = (Array.isArray(athleteIds) ? athleteIds : athleteIds ? [athleteIds] : [])
    .filter(Boolean)
    .sort();

  return useQuery({
    queryKey: ["unfinished-workouts", ids],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<UnfinishedWorkout[]> => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id, athlete_id, session_name, scheduled_date, athlete_modifications")
        .in("athlete_id", ids)
        .eq("status", "planned")
        .lt("scheduled_date", todayISO())
        .order("scheduled_date", { ascending: false })
        .limit(200);
      if (error) throw error;

      return (data ?? [])
        .map((row) => ({
          id: row.id,
          athleteId: row.athlete_id,
          sessionName: row.session_name,
          scheduledDate: row.scheduled_date,
          loggedSets: countLoggedSets(row.athlete_modifications as AthleteModifications | null),
        }))
        .filter((w) => w.loggedSets > 0);
    },
  });
}
