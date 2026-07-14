import { supabase } from "@/integrations/supabase/client";

export type NutritionStrategyType = "maintenance" | "seche" | "prise_de_masse";

export type CalorieMode = "nap" | "active" | "hybrid";

export type DeficitMode = "fixed" | "range";

export interface NutritionStrategy {
  strategy: NutritionStrategyType;
  can_track_calories: boolean; // legacy, remplacé par calorie_mode
  calorie_mode?: CalorieMode | null;
  deficit_mode?: DeficitMode | null;
  nap?: number | null;
  total_calories_coach?: number | null;
  total_calories_min?: number | null; // borne basse fourchette kcal (deficit_mode = range)
  total_calories_max?: number | null; // borne haute fourchette kcal (deficit_mode = range)
  tdee_ref?: number | null;           // dépense de référence BMR × NAP au moment du plan
  target_weight?: number | null;
  surplus_deficit_min?: number | null;
  surplus_deficit_max?: number | null;
  weekly_target_kg?: number | null;
  macros_glucides?: number | null;
  macros_lipides?: number | null;
  macros_proteines?: number | null;
  macros_glucides_pct?: number | null;
  macros_lipides_pct?: number | null;
  macros_proteines_pct?: number | null;
}

export interface NutritionDailyLog {
  active_calories?: number | null;
  total_calories_consumed?: number | null;
  glucides_consumed?: number | null;
  lipides_consumed?: number | null;
  proteines_consumed?: number | null;
}

// ── Évaluation du jour vs objectif ──────────────────────────────────────────
// L'objectif est un % de déficit/surplus vs la dépense de référence (pas des
// kcal figées) : l'athlète peut saisir ses calories brûlées, la référence bouge.
// Tolérance : ±2 points de % pour être "dans l'objectif", ±5 pts pour "proche".
export const NUTRITION_TOLERANCE_PCT = 2;
export const NUTRITION_CLOSE_PCT = 5;

export type NutritionDayStatus = "ok" | "close" | "off";

export interface NutritionDayEval {
  status: NutritionDayStatus;
  /** Dépense de référence utilisée (BMR + actives, ou TDEE du plan) */
  reference: number;
  /** % réel de surplus/déficit vs la référence (négatif = déficit) */
  actualPct: number;
  /** Fenêtre de % visée par le coach (wMin = wMax en mode fixe) */
  windowMin: number;
  windowMax: number;
  /** Bornes kcal correspondantes (affichage) */
  targetMin: number;
  targetMax: number;
  /** Milieu kcal de la zone (affichage) */
  target: number;
  isRange: boolean;
  /** Écart en points de % vs la fenêtre (0 si dedans) */
  diffPct: number;
}

/** Dépense de référence quand l'athlète n'a pas saisi ses calories actives. */
function fallbackReference(s: NutritionStrategy): number {
  if (s.tdee_ref && s.tdee_ref > 0) return s.tdee_ref;
  const coach = s.total_calories_coach ?? 0;
  // Legacy : retrouver le TDEE depuis la cible kcal + les %
  if (s.deficit_mode === "range") {
    if (s.total_calories_min != null && s.surplus_deficit_min != null) {
      return Math.round(s.total_calories_min / (1 + s.surplus_deficit_min / 100));
    }
    return coach; // très ancien bug : la cible sauvegardée était le TDEE brut
  }
  const p = s.strategy === "seche" ? (s.surplus_deficit_min ?? 0)
    : s.strategy === "prise_de_masse" ? (s.surplus_deficit_max ?? 0)
    : 0;
  return p !== 0 && coach > 0 ? Math.round(coach / (1 + p / 100)) : coach;
}

/**
 * Évalue la journée vs le plan du coach, en % de déficit/surplus.
 * `activeDepense` = BMR + calories actives saisies par l'athlète (prioritaire).
 */
export function evaluateNutritionDay(
  strategy: NutritionStrategy,
  consumed: number,
  activeDepense?: number | null
): NutritionDayEval | null {
  if (!consumed || consumed <= 0) return null;

  const reference = (activeDepense && activeDepense > 0) ? activeDepense : fallbackReference(strategy);
  if (!reference || reference <= 0) return null;

  // Fenêtre de % visée (signée : déficit < 0). Fixe → wMin = wMax.
  let wMin = strategy.surplus_deficit_min;
  let wMax = strategy.surplus_deficit_max;
  if (wMin == null || wMax == null) { wMin = 0; wMax = 0; } // pas de % défini → viser la référence
  // Legacy : fourchette sèche saisie en positif ("12" = déficit 12%) → resigner
  if (strategy.strategy === "seche" && wMin > 0 && wMax > 0) { wMin = -wMin; wMax = -wMax; }
  if (wMin > wMax) [wMin, wMax] = [wMax, wMin];
  const isRange = strategy.deficit_mode === "range" && wMin !== wMax;
  // Mode fixe legacy : computeMinMax stockait [-v, -v/2] (sèche) — la vraie cible est la pleine valeur
  if (!isRange && strategy.deficit_mode !== "range") {
    if (strategy.strategy === "seche") wMax = wMin;
    else if (strategy.strategy === "prise_de_masse") wMin = wMax;
  }

  const actualPct = ((consumed - reference) / reference) * 100;

  const status: NutritionDayStatus =
    actualPct >= wMin - NUTRITION_TOLERANCE_PCT && actualPct <= wMax + NUTRITION_TOLERANCE_PCT ? "ok"
    : actualPct >= wMin - NUTRITION_CLOSE_PCT && actualPct <= wMax + NUTRITION_CLOSE_PCT ? "close"
    : "off";

  const diffPct = actualPct < wMin ? actualPct - wMin : actualPct > wMax ? actualPct - wMax : 0;

  const targetMin = Math.round(reference * (1 + wMin / 100));
  const targetMax = Math.round(reference * (1 + wMax / 100));

  return {
    status, reference, actualPct,
    windowMin: wMin, windowMax: wMax,
    targetMin, targetMax,
    target: Math.round((targetMin + targetMax) / 2),
    isRange, diffPct,
  };
}

const STRATEGY_KEY = "asp:nutrition_strategy";
const LOG_KEY = "asp:nutrition_log";

async function appLoad<T>(key: string, athleteId: string, fallback: T): Promise<T> {
  const { data } = await supabase
    .from("app_data")
    .select("value")
    .eq("athlete_id", athleteId)
    .eq("key", key)
    .maybeSingle();
  return (data?.value as T) ?? fallback;
}

async function appSave(key: string, value: unknown, athleteId: string): Promise<void> {
  const { error } = await supabase
    .from("app_data")
    .upsert(
      { athlete_id: athleteId, key, value, updated_at: new Date().toISOString() },
      { onConflict: "athlete_id,key" }
    );
  if (error) throw new Error(error.message);
}

export async function getNutritionStrategy(athleteId: string): Promise<NutritionStrategy | null> {
  return appLoad<NutritionStrategy | null>(STRATEGY_KEY, athleteId, null);
}

export async function upsertNutritionStrategy(athleteId: string, data: NutritionStrategy): Promise<void> {
  return appSave(STRATEGY_KEY, data, athleteId);
}

export async function getDailyLog(athleteId: string, date: string): Promise<NutritionDailyLog | null> {
  const all = await appLoad<Record<string, NutritionDailyLog>>(LOG_KEY, athleteId, {});
  return all[date] ?? null;
}

export async function upsertDailyLog(athleteId: string, date: string, data: NutritionDailyLog): Promise<void> {
  const all = await appLoad<Record<string, NutritionDailyLog>>(LOG_KEY, athleteId, {});
  return appSave(LOG_KEY, { ...all, [date]: data }, athleteId);
}
