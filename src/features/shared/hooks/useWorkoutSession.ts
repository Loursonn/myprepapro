/**
 * useWorkoutSession — fetches a workout_log by id and resolves the corresponding
 * ProgSession from app_data, returning workout-ready data for the athlete fill page.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProgrammation } from "@/features/coach/components/programmation/hooks/useProgrammation";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { defaultExerciceParams } from "@/features/coach/components/programmation/types";
import type { ExerciceParams } from "@/features/coach/components/programmation/types";
import type { AthleteModifications } from "../types/athlete";

export interface WorkoutExerciceData {
  id: string;
  exercise_name: string;
  params: ExerciceParams;
  mode: "classique" | "methode";
  methode_id?: string;
}

export interface WorkoutBlocData {
  id: string;
  name: string;
  series_mode: "libre" | "fixe";
  series_count?: number;
  timing_mode: "libre" | "depart" | "repos";
  timing_repos_min?: number;
  timing_repos_sec?: number;
  timing_depart_min?: number;
  timing_depart_sec?: number;
  exercices: WorkoutExerciceData[];
}

export interface WorkoutSessionResult {
  isLoading: boolean;
  workoutLogId: string | null;
  sessionId: string | null;
  sessionName: string;
  sessionShort: string;
  blocs: WorkoutBlocData[];
  status: string;
  rpeScore: number | null;
  scheduledDate: string | null;
  weekNumber: number;
  athleteModifications: AthleteModifications | null;
  rescheduledByAthlete: boolean;
  originalScheduledDate: string | null;
}

export function useWorkoutSession(workoutLogId: string | undefined): WorkoutSessionResult {
  const { athleteId } = useAthleteContext();

  const { data: wlog, isLoading: loadingLog } = useQuery({
    queryKey: ["workout-log-detail", workoutLogId],
    enabled: !!workoutLogId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_logs")
        .select(
          "id, session_id, session_name, status, rpe_score, scheduled_date, athlete_modifications, microcycle_id, original_scheduled_date, rescheduled_by_athlete"
        )
        .eq("id", workoutLogId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: microcycle } = useQuery({
    queryKey: ["microcycle", wlog?.microcycle_id],
    enabled: !!wlog?.microcycle_id,
    staleTime: 300_000,
    queryFn: async () => {
      const id = wlog?.microcycle_id;
      if (!id) return null;
      const { data } = await supabase
        .from("microcycles")
        .select("week_number, cycle_id")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const { data: progSessions = [], isLoading: loadingSessions } = useProgrammation(athleteId);

  return useMemo(() => {
    const isLoading = loadingLog || loadingSessions;
    const weekNumber = microcycle?.week_number ?? 1;

    const empty: WorkoutSessionResult = {
      isLoading,
      workoutLogId: null,
      sessionId: null,
      sessionName: "",
      sessionShort: "",
      blocs: [],
      status: "planned",
      rpeScore: null,
      scheduledDate: null,
      weekNumber: 1,
      athleteModifications: null,
      rescheduledByAthlete: false,
      originalScheduledDate: null,
    };

    if (!wlog) return empty;

    const progSession = progSessions.find((s) => s.id === wlog.session_id);
    if (!progSession) {
      return {
        ...empty,
        isLoading: false,
        workoutLogId: wlog.id,
        sessionId: wlog.session_id,
        sessionName: wlog.session_name,
        sessionShort: wlog.session_name.slice(0, 3).toUpperCase(),
        status: wlog.status,
        scheduledDate: wlog.scheduled_date,
        athleteModifications:
          (wlog.athlete_modifications as AthleteModifications | null) ?? null,
      };
    }

    const mods =
      (wlog.athlete_modifications as AthleteModifications | null) ?? null;

    const blocs: WorkoutBlocData[] = progSession.blocs.map((bloc) => {
      const nbSeriesFixed =
        bloc.series_mode === "fixe" && bloc.series_count
          ? bloc.series_count
          : null;

      return {
        id: bloc.id,
        name: bloc.name,
        series_mode: bloc.series_mode,
        series_count: bloc.series_count,
        timing_mode: bloc.timing_mode,
        timing_repos_min: bloc.timing_repos_min,
        timing_repos_sec: bloc.timing_repos_sec,
        timing_depart_min: bloc.timing_depart_min,
        timing_depart_sec: bloc.timing_depart_sec,
        exercices: bloc.exercices.map((ex) => {
          let params: ExerciceParams;

          if (
            ex.multi_semaine &&
            typeof ex.params === "object" &&
            !("nb_series" in ex.params)
          ) {
            const paramsMap = ex.params as Record<string, ExerciceParams>;
            params =
              paramsMap[String(weekNumber)] ??
              paramsMap["1"] ??
              defaultExerciceParams();
          } else {
            params = ex.params as ExerciceParams;
          }

          const effectiveNbSeries = nbSeriesFixed ?? params.nb_series;

          return {
            id: ex.id,
            exercise_name: ex.exercise_name,
            params: { ...params, nb_series: effectiveNbSeries },
            mode: ex.mode,
            methode_id: ex.methode_id,
          };
        }),
      };
    });

    return {
      isLoading: false,
      workoutLogId: wlog.id,
      sessionId: wlog.session_id,
      sessionName: progSession.name,
      sessionShort: progSession.short,
      blocs,
      status: wlog.status,
      rpeScore: wlog.rpe_score ?? null,
      scheduledDate: wlog.scheduled_date,
      weekNumber,
      athleteModifications: mods,
      rescheduledByAthlete: wlog.rescheduled_by_athlete ?? false,
      originalScheduledDate: wlog.original_scheduled_date ?? null,
    };
  }, [wlog, progSessions, microcycle, loadingLog, loadingSessions]);
}
