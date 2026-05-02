import type { NutritionStrategy } from "@/lib/nutrition";

// ─── Block & Session ─────────────────────────────────────────────────────────

export interface WeekConfig {
  kg?: number;
  pdc?: boolean;
  sets?: number;
  repsRange?: string;
  rir?: number;
  method?: string;
  methodParams?: Record<string, unknown>;
  coachNote?: string;
  tempo?: string;
}

export interface Exercise {
  id: string;
  name: string;
  bloc?: string;
  target?: string;
  exType?: string;
  isFlexibility?: boolean;
  exercise_id?: string;
  weeks: Record<number, WeekConfig>;
}

export type ExosMap = Record<string, Exercise[]>;

export interface SetRow {
  done?: boolean;
  kg?: number;
  reps?: number;
  rir?: number | null;
  type?: string;
}

export type SetsMap = Record<string, SetRow[]>;

export interface Session {
  id: string;
  name: string;
  short: string;
  day_of_week?: number;
  weekDays?: Record<string, number>;
  recurrence?: "weekly" | "once";
}

export interface BlockConfig {
  blockName?: string;
  objective?: string;
  totalWeeks: number;
  deloadWeek: number;
  startDate?: string | null;
  tierConfig?: Record<string, TierConfig>;
}

export interface TierConfig {
  mode?: string;
  kgStep?: number;
  rirStart?: number;
  rirEnd?: number;
  repsEnd?: number;
  deloadPct?: number;
  rir?: number;
}

// ─── Wellness & Body ──────────────────────────────────────────────────────────

export interface WellnessData {
  date?: string;
  score?: number;
  fatigue?: number;
  sommeil?: number;
  stress?: number;
  energie?: number;
  doms?: number;
  poids?: number;
  sleepDur?: number;
  coucher?: { h: number; m: number };
  reveil?: { h: number; m: number };
  sleepInterrupt?: boolean;
  sleepInterruptNote?: string;
  domsZones?: string[];
  injComment?: string;
}

export interface BodyWeight {
  current: number;
  target: number;
}

// ─── Injuries ────────────────────────────────────────────────────────────────

export interface Injury {
  id: string;
  zones: string[];
  type?: string;
  intensity?: number;
  status: string;
  date_start?: string;
  date_end?: string;
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export interface Goals {
  sessionsPerWeek: number;
  sleepTarget: number;
}

// ─── Habit ───────────────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  athlete_id: string;
  name: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

// ─── Energy ──────────────────────────────────────────────────────────────────

export interface EnergySession {
  id: string;
  session_key: string;
  session_label: string;
  appareil_types: string[];
  athlete_id?: string;
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export interface CoachFeedbacks {
  [week: number]: { note?: string; rating?: number; date?: string };
}

export interface AppFeedbackEntry {
  id: string;
  date: string;
  rating: number;
  text?: string;
}

// ─── Visibility ──────────────────────────────────────────────────────────────

export interface VisibilitySettings {
  muscu: boolean;
  energy: boolean;
  tests: boolean;
  wellness: boolean;
  nutrition: boolean;
  pr: boolean;
  weight: boolean;
}

// ─── Session Logs ────────────────────────────────────────────────────────────

export interface SessionLog {
  note?: string;
  forme?: number;
  duration?: number;
  date?: string;
}

// ─── Free Session ────────────────────────────────────────────────────────────

export interface FreeSession {
  id: string;
  name: string;
  completed?: boolean;
  date?: string;
  sport?: string;
  sportEmoji?: string;
  duration?: number;
  intensity?: number;
  note?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exercises?: any[];
}

// ─── Block History ───────────────────────────────────────────────────────────

export interface ArchivedBlock {
  id?: string;
  archivedAt: string;
  exos: ExosMap;
  sets: SetsMap;
  completedSessions: Record<number, string[]>;
  sessions: Session[];
  blockConfig: BlockConfig;
  goals: Goals;
  wellnessHistory: Record<string, WellnessData>;
  bodyWeight: BodyWeight;
  athleteNotes: Record<string, string>;
}

// ─── New block options (from NewBlockModal) ───────────────────────────────────

export interface NewBlockOpts {
  sessions: Session[];
  restoredExos?: ExosMap;
  exos?: ExosMap;
  config?: boolean;
  blockName?: string;
  objective?: string;
  totalWeeks?: number;
  deloadWeek?: number;
  sessPerWeek?: number;
}

// ─── Re-export external types ─────────────────────────────────────────────────

export type { NutritionStrategy };
