// ─────────────────────────────────────────────────────────────────────────────
// Types stricts pour le module énergie — structure JSONB intervals
// ─────────────────────────────────────────────────────────────────────────────

// ── Durée ────────────────────────────────────────────────────────────────────

export type DurationKind = 'time' | 'distance' | 'calories' | 'lap_button';

/** Représente la durée d'un intervalle.
 *  - time       : value en secondes
 *  - distance   : value en mètres
 *  - calories   : value en kcal
 *  - lap_button : fin sur action manuelle (pas de value)
 */
export interface EnergyDuration {
  kind: DurationKind;
  /** Secondes / mètres / kcal selon kind. Absent pour lap_button. */
  value?: number;
}

// ── Cible d'intensité (union discriminée sur `kind`) ─────────────────────────

export type EnergyTarget =
  /** Pas de cible définie */
  | { kind: 'none' }
  /** Zone FC 1–5 (zones Karvonen ou sport spécifique) */
  | { kind: 'hr_zone'; zone: 1 | 2 | 3 | 4 | 5 }
  /** % de FC max : fourchette */
  | { kind: 'hr_pct'; min: number; max: number }
  /** FC absolue en bpm : fourchette */
  | { kind: 'hr_bpm'; min: number; max: number }
  /** Allure en s/km (min_per_km) ou vitesse en km/h (kmh) : fourchette en secondes par km */
  | { kind: 'pace'; min_s_per_unit: number; max_s_per_unit: number; unit: 'min_per_km' | 'kmh' }
  /** % d'une métrique test (ex. % VMA, % VC) : fourchette */
  | { kind: 'pace_test_pct'; test_metric: string; min: number; max: number }
  /** Puissance en watts : fourchette */
  | { kind: 'power'; min: number; max: number }
  /** % de la puissance test : fourchette */
  | { kind: 'power_test_pct'; test_metric: string; min: number; max: number }
  /** Cadence : fourchette + unité (spm = pas/min, rpm = tours/min) */
  | { kind: 'cadence'; min: number; max: number; unit: 'spm' | 'rpm' }
  /** Ratio x par y (ex. 500 cal / 1 km) */
  | {
      kind: 'x_per_y';
      x_kind: 'time' | 'cal' | 'watt';
      y_kind: 'time' | 'distance';
      x_value: number;
      y_value: number;
    }
  /** Consigne textuelle libre (ex. "Ressenti 7/10") */
  | { kind: 'text'; value: string };

// ── Rôle d'un intervalle dans la séance ──────────────────────────────────────

export type IntervalRole =
  | 'warmup'    // Échauffement
  | 'work'      // Effort principal
  | 'recovery'  // Récupération active entre efforts
  | 'rest'      // Repos passif
  | 'cooldown'  // Retour au calme
  | 'open';     // Libre (pas de rôle défini)

// ── EnergyInterval ────────────────────────────────────────────────────────────
/** Unité atomique d'un programme : un effort de durée définie avec une cible. */
export interface EnergyInterval {
  type: 'interval';
  id: string;
  role: IntervalRole;
  duration: EnergyDuration;
  target: EnergyTarget;
  notes?: string;
}

// ── EnergyGroup ───────────────────────────────────────────────────────────────
/** Groupe répété de steps (ex. 6 × [400m@VMA / 90s récup]).
 *  Les enfants peuvent eux-mêmes être des groupes (imbrication).
 */
export interface EnergyGroup {
  type: 'group';
  id: string;
  role: IntervalRole;
  /** Nombre de répétitions du groupe (≥ 1) */
  repeat: number;
  /** Séquence d'intervals ou de sous-groupes */
  children: EnergyStep[];
  /** Intervalle de repos inséré après chaque répétition (optionnel) */
  rest_between?: EnergyInterval;
}

// ── EnergyStep (union discriminée sur `type`) ─────────────────────────────────
export type EnergyStep = EnergyInterval | EnergyGroup;

// ── Constantes de domaine ─────────────────────────────────────────────────────

export type SessionKind =
  | 'vo2'      // VO₂max / VMA
  | 'tempo'    // Allure tempo / course continue modérée
  | 'seuil'    // Seuil lactique / SV1-SV2
  | 'footing'  // Endurance fondamentale
  | 'fartlek'  // Jeu de fartlek / variabilité libre
  | 'autre'    // Non classifié
  | 'custom';  // Personnalisé (custom_kind obligatoire)

export type StructureType = 'continu' | 'fractionne';

export type AssignmentStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'missed'
  | 'skipped';

// ── Entités DB ────────────────────────────────────────────────────────────────

export interface EnergySessionRow {
  id: string;
  name: string;
  session_kind: SessionKind;
  custom_kind?: string | null;
  structure_type: StructureType;
  /** Tableau sérialisé EnergyStep[] */
  intervals: EnergyStep[];
  total_duration_s?: number | null;
  total_distance_m?: number | null;
  notes?: string | null;
  created_by?: string | null;
  is_public: boolean;
  is_verified: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnergySessionAssignmentRow {
  id: string;
  athlete_id: string;
  coach_id?: string | null;
  energy_session_id: string;
  scheduled_date: string;  // ISO date YYYY-MM-DD
  status: AssignmentStatus;
  microcycle_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Jointure optionnelle
  energy_sessions?: EnergySessionRow;
}

// ── Inputs pour création ──────────────────────────────────────────────────────

export type CreateEnergySessionInput = Omit<
  EnergySessionRow,
  'id' | 'is_public' | 'is_verified' | 'verified_by' | 'verified_at' | 'created_at' | 'updated_at'
>;

export type CreateAssignmentInput = Omit<
  EnergySessionAssignmentRow,
  'id' | 'created_at' | 'updated_at' | 'energy_sessions'
>;
