import { supabase } from "@/integrations/supabase/client";

export type NutritionStrategyType = "maintenance" | "seche" | "prise_de_masse";

export interface NutritionStrategy {
  strategy: NutritionStrategyType;
  can_track_calories: boolean;
  total_calories_coach?: number | null;
  target_weight?: number | null;
  surplus_deficit_min?: number | null;
  surplus_deficit_max?: number | null;
  macros_glucides?: number | null;
  macros_lipides?: number | null;
  macros_proteines?: number | null;
}

export interface NutritionDailyLog {
  active_calories?: number | null;
  total_calories_consumed?: number | null;
  glucides_consumed?: number | null;
  lipides_consumed?: number | null;
  proteines_consumed?: number | null;
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
