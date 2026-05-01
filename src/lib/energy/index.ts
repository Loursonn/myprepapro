/**
 * src/lib/energy/index.ts
 *
 * Helpers purs pour le module énergie.
 * Zéro dépendance React / Supabase / browser.
 * Toutes les fonctions sont déterministes et testables unitairement.
 */

import type { EnergyDuration, EnergyGroup, EnergyInterval, EnergyStep, EnergyTarget } from '@/types/energy';

// ─────────────────────────────────────────────────────────────────────────────
// Types internes
// ─────────────────────────────────────────────────────────────────────────────

export interface FlatInterval {
  /** L'intervalle atomique développé */
  interval: EnergyInterval;
  /** Profondeur d'imbrication (0 = enfant direct du groupe racine) */
  depth: number;
  /** Index de cet intervalle dans son parent immédiat */
  indexInParent: number;
}

export interface SessionTotals {
  /** Durée totale estimée en secondes (lap_button = 0) */
  durationS: number;
  /** Distance totale en mètres (0 si inconnue) */
  distanceM: number;
  /** Nombre d'intervalles de rôle 'work' */
  workCount: number;
}

export interface ZoneDistribution {
  z1: number;  // secondes en zone 1
  z2: number;
  z3: number;
  z4: number;
  z5: number;
  uncategorized: number;  // intensité nulle ou non chiffrable
}

// ─────────────────────────────────────────────────────────────────────────────
// expandIntervals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Développe récursivement un EnergyGroup en liste plate d'intervalles atomiques,
 * en répétant chaque groupe selon son champ `repeat`.
 *
 * Si `rest_between` est défini sur le groupe, il est inséré entre chaque répétition
 * (pas après la dernière). Son `indexInParent` est -1 pour le distinguer.
 *
 * @param root  Groupe racine à développer
 * @returns     Tableau ordonné de FlatInterval
 */
export function expandIntervals(root: EnergyGroup): FlatInterval[] {
  return _expand(root, 0);
}

function _expand(group: EnergyGroup, depth: number): FlatInterval[] {
  const result: FlatInterval[] = [];
  const { repeat, children, rest_between } = group;

  for (let rep = 0; rep < repeat; rep++) {
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.type === 'interval') {
        result.push({ interval: child, depth, indexInParent: i });
      } else {
        // Groupe imbriqué : développe récursivement
        const nested = _expand(child, depth + 1);
        result.push(...nested);
      }
    }
    // Repos entre répétitions (pas après la dernière)
    if (rest_between && rep < repeat - 1) {
      result.push({ interval: rest_between, depth, indexInParent: -1 });
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// estimateIntervalDuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estime la durée d'un intervalle en secondes.
 *
 * Logique de conversion :
 *  - time       → value directement (en s)
 *  - distance   → utilise la cible de l'intervalle si disponible (pace), sinon 4 m/s
 *                 (≈ 14,4 km/h, vitesse de jogging modéré — valeur conservative)
 *  - calories   → 10 kcal/min = 6 s/kcal (dépense modérée à haute intensité)
 *  - lap_button → 0 (durée inconnue, exclue des totaux per spec)
 */
export function estimateIntervalDuration(interval: EnergyInterval): number {
  const { duration, target } = interval;
  return _durationToSeconds(duration, target);
}

function _durationToSeconds(duration: EnergyDuration, target?: EnergyTarget): number {
  switch (duration.kind) {
    case 'time':
      return duration.value ?? 0;

    case 'distance': {
      const distM = duration.value ?? 0;
      if (distM === 0) return 0;
      // Tente d'utiliser l'allure cible si disponible
      const mPerS = _targetToMetersPerSecond(target);
      return Math.round(distM / mPerS);
    }

    case 'calories': {
      // 10 kcal/min = 1 kcal / 6 s (effort modéré-intense)
      return Math.round((duration.value ?? 0) * 6);
    }

    case 'lap_button':
      return 0;

    default:
      return 0;
  }
}

/**
 * Tente de dériver une vitesse en m/s depuis la cible.
 * Retourne 4 m/s (conservative) si la cible ne donne pas d'allure absolue.
 *
 * Conservative default : 4 m/s ≈ 14,4 km/h ≈ allure 4:10/km
 * (sous-estimation volontaire pour ne pas gonfler la durée totale)
 */
function _targetToMetersPerSecond(target?: EnergyTarget): number {
  const DEFAULT_M_PER_S = 4;

  if (!target) return DEFAULT_M_PER_S;

  if (target.kind === 'pace') {
    const avg = (target.min + target.max) / 2;
    if (target.unit === 'kmh') {
      return avg / 3.6;  // km/h → m/s
    }
    // min/km → m/s : 1 min/km = 1000 m / (avg * 60 s)
    if (avg > 0) return 1000 / (avg * 60);
  }

  return DEFAULT_M_PER_S;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeTotals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule les totaux d'une séance à partir de sa liste plate d'intervalles.
 *
 * - durationS  : somme des durées estimées (lap_button = 0 per spec)
 * - distanceM  : somme des distances quand duration.kind === 'distance'
 *                (les intervalles en temps ne contribuent pas à distanceM,
 *                 car l'allure réelle dépend de l'athlète)
 * - workCount  : nombre d'intervalles de rôle 'work'
 */
export function computeTotals(flat: FlatInterval[]): SessionTotals {
  let durationS = 0;
  let distanceM = 0;
  let workCount = 0;

  for (const { interval } of flat) {
    durationS += estimateIntervalDuration(interval);

    if (interval.duration.kind === 'distance') {
      distanceM += interval.duration.value ?? 0;
    }

    if (interval.role === 'work') workCount++;
  }

  return { durationS, distanceM, workCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// targetToIntensityPct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convertit une cible en pourcentage d'intensité (0–100) ou null.
 *
 * Mapping :
 *   hr_zone        → Z1=20, Z2=40, Z3=60, Z4=80, Z5=100
 *   hr_pct         → moyenne(min, max)
 *   pace_test_pct  → moyenne(min, max)  [% de la métrique test]
 *   power_test_pct → moyenne(min, max)
 *   hr_bpm         → null  (valeur relative sans FCmax connue)
 *   pace           → null  (allure absolue, pas de référence commune)
 *   power          → null
 *   cadence        → null
 *   x_per_y        → null
 *   text           → null
 *   none           → null
 */
export function targetToIntensityPct(target: EnergyTarget): number | null {
  switch (target.kind) {
    case 'hr_zone': {
      const map: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 };
      return map[target.zone];
    }
    case 'hr_pct':
      return (target.min + target.max) / 2;
    case 'pace_test_pct':
      return (target.min + target.max) / 2;
    case 'power_test_pct':
      return (target.min + target.max) / 2;

    case 'hr_bpm':
    case 'pace':
    case 'power':
    case 'cadence':
    case 'x_per_y':
    case 'text':
    case 'none':
      return null;

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// intensityToColor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mappe un pourcentage d'intensité (0–100) sur une couleur HSL.
 *
 * Gradient continu :
 *   0%   → hsl(140, 70%, 50%)  vert
 *   100% → hsl(0,   80%, 50%)  rouge
 *
 * Interpolation linéaire sur hue (140→0) et saturation (70%→80%).
 * La luminosité reste constante à 50%.
 *
 * @param pct  Valeur en [0, 100] — clampée si hors plage
 */
export function intensityToColor(pct: number): string {
  const t = Math.max(0, Math.min(100, pct)) / 100;  // normalise en [0,1]
  const hue = Math.round(140 * (1 - t));             // 140 → 0
  const sat  = Math.round(70 + 10 * t);              // 70% → 80%
  return `hsl(${hue}, ${sat}%, 50%)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeZoneDistribution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Répartit la durée de la séance par zone d'intensité (en secondes).
 *
 * Seuils d'attribution (sur le % retourné par targetToIntensityPct) :
 *   ≤ 30  → Z1
 *   ≤ 50  → Z2
 *   ≤ 70  → Z3
 *   ≤ 85  → Z4
 *   > 85  → Z5
 *   null  → uncategorized
 *
 * La durée de chaque intervalle est estimée via estimateIntervalDuration.
 */
export function computeZoneDistribution(flat: FlatInterval[]): ZoneDistribution {
  const dist: ZoneDistribution = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, uncategorized: 0 };

  for (const { interval } of flat) {
    const dur = estimateIntervalDuration(interval);
    const pct = targetToIntensityPct(interval.target);

    if (pct === null) {
      dist.uncategorized += dur;
    } else if (pct <= 30) {
      dist.z1 += dur;
    } else if (pct <= 50) {
      dist.z2 += dur;
    } else if (pct <= 70) {
      dist.z3 += dur;
    } else if (pct <= 85) {
      dist.z4 += dur;
    } else {
      dist.z5 += dur;
    }
  }

  return dist;
}
