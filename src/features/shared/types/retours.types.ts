// Types pour les retours hebdomadaires enrichis

export interface WorkoutExerciseComment {
  id: string;
  workout_log_id: string;
  exercise_id: string | null;
  exercise_name: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

export interface PerformedSet {
  set_num: number;
  kg: number | null;
  reps: number | null;
  rir: number | null;
  method: string | null;
}

export interface PerformedExercise {
  exercise_id: string;
  exercise_name: string;
  sets: PerformedSet[];
}

export interface PlannedExercise {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps_range: string | null;
  kg: number | null;
  rir: number | null;
  method: string | null;
}

// ── Type wellness d'une journée ───────────────────────────────────────────────

export interface WellnessDay {
  score:      number;
  fatigue:    number;
  sommeil:    number;
  stress:     number;
  energie:    number;
  doms?:      number;
  domsZones?: string[];
  coucher?:   { h: number; m: number };
  reveil?:    { h: number; m: number };
  sleepDur?:  number;  // heures
}

// ── Séance énergétique ────────────────────────────────────────────────────────

export interface EnergySessionDetail {
  id: string;
  session_label: string;
  date: string;
  completed: boolean;
  duration_min: number | null;   // energy_sessions.total_duration_s / 60
  distance_m: number | null;     // energy_sessions.total_distance_m
  session_kind: string | null;   // energy_sessions.session_kind
  note: string | null;           // energy_session_assignments.notes
}

// ── WeeklyRetourData ──────────────────────────────────────────────────────────

export interface WeeklyRetourData {
  week_number: number;
  start_date: string;
  end_date: string;

  workouts: {
    id: string;
    session_name: string;
    scheduled_date: string;
    status: 'planned' | 'completed' | 'missed' | 'skipped';
    duration_s: number | null;
    notes: string | null;
    rpe_score: number | null;
    wellness_day: number | null;
    exercise_comments: WorkoutExerciseComment[];
    planned_exercises: PlannedExercise[];
    performed_exercises: PerformedExercise[];
  }[];

  energy_sessions: EnergySessionDetail[];

  test_sessions: {
    id: string;
    title: string;
    type: string;
    date: string;
    completed: boolean;
    results_note: string | null;
    coach_validated: boolean | null;
  }[];

  competitions: {
    id: string;
    name: string;
    type: string;
    date: string;
    location: string | null;
    athlete_comment: string | null;
    priority: 'A' | 'B' | 'C' | null;
  }[];

  avg_wellness: number | null;
  daily_wellness: Record<string, WellnessDay | null>;
}

export interface WeekComparisonData {
  current_week: WeeklyRetourData;
  previous_week: WeeklyRetourData | null;
}

// ── Types mensuel ─────────────────────────────────────────────────────────────

export interface DailyData {
  date: string;
  wellness: WellnessDay | null;
  workouts_completed: number;
  has_competition: boolean;
  has_test: boolean;
}

export interface WorkoutDetail {
  id: string;
  session_name: string;
  scheduled_date: string;
  status: 'planned' | 'completed' | 'missed' | 'skipped';
  session_type: 'muscu' | 'specific';
  duration_s: number | null;
  notes: string | null;
  rpe_score: number | null;
  wellness_day: number | null;
  planned_exercises: PlannedExercise[];
  performed_exercises: PerformedExercise[];
  exercise_comments: WorkoutExerciseComment[];
}

export interface TestDetail {
  id: string;
  title: string;
  type: string;
  date: string;
  completed: boolean;
  results_note: string | null;
  coach_validated: boolean | null;
}

export interface CompetitionDetail {
  id: string;
  name: string;
  type: string;
  date: string;
  location: string | null;
  athlete_comment: string | null;
  priority: 'A' | 'B' | 'C' | null;
}

export interface MonthlyRetourData {
  month: string;          // "yyyy-MM"
  start_date: string;
  end_date: string;
  avg_wellness: number | null;
  workouts_completed: number;
  workouts_total: number;
  workouts_by_type: { muscu: number; specific: number; energy: number };
  tests_completed: number;
  daily_data: Record<string, DailyData>;
  workouts: WorkoutDetail[];
  energy_sessions: EnergySessionDetail[];
  test_sessions: TestDetail[];
  competitions: CompetitionDetail[];
}
