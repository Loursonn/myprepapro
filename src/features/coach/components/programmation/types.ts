export type ParamValue<T> =
  | { mode: 'global'; value: T }
  | { mode: 'par_serie'; values: T[] }

export interface ClusterConfig {
  nb_clusters: number
  reps_per_cluster: number
  recup_sec: number
}

export interface ExerciceParams {
  nb_series: number
  cluster?: ClusterConfig
  reps: ParamValue<number>
  reps_mode: ParamValue<'EC' | 'iso'>
  charge_unit: '%RM' | 'kg' | 'PDC'
  charge: ParamValue<number | null>
  rir: ParamValue<number>
  tempo: ParamValue<string>
}

export interface Exercice {
  id: string
  exercise_id: string
  exercise_name: string
  mode: 'classique' | 'methode'
  methode_id?: string
  sort_order: number
  // If multi_semaine on bloc: Record<weekNumber, ExerciceParams>; else ExerciceParams
  params: ExerciceParams | Record<string, ExerciceParams>
}

export interface Bloc {
  id: string
  name: string
  series_mode: 'libre' | 'fixe'
  series_count?: number
  timing_mode: 'depart' | 'repos'
  timing_depart_min?: number
  timing_repos_min?: number
  timing_repos_sec?: number
  multi_semaine: boolean
  nb_semaines?: number
  exercices: Exercice[]
  sort_order: number
}

export function defaultExerciceParams(nb_series = 4): ExerciceParams {
  return {
    nb_series,
    reps: { mode: 'global', value: 8 },
    reps_mode: { mode: 'global', value: 'EC' },
    charge_unit: 'kg',
    charge: { mode: 'global', value: null },
    rir: { mode: 'global', value: 2 },
    tempo: { mode: 'global', value: '' },
  }
}
