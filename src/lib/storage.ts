import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const SKEYS = {
  exos:           "asp:exos",
  exMeta:         "asp:exMeta",
  sets:           "asp:sets",
  wellness:       "asp:wellness",
  wellnessHistory:"asp:wh",
  bw:             "asp:bw",
  completed:      "asp:completed",
  goals:          "asp:goals",
  anotes:         "asp:anotes",
  custMethods:    "asp:custmethods",
  weightLog:      "asp:wlog",
  weightMilestones:"asp:wmile",
  injuries:       "asp:injuries",
  sessions:       "asp:sessions",
  blockConfig:    "asp:blockConfig",
  blockHistory:   "asp:blockHistory",
  weekSchedule:   "asp:weekschedule",
  sessionLogs:    "asp:sessionlogs",
  freeSessions:   "asp:freesess",
} as const;

export async function sLoad<T>(k: string, fb: T, aid: string | null | undefined): Promise<T> {
  if (!aid) return fb;
  try {
    const { data } = await db
      .from("app_data")
      .select("value")
      .eq("athlete_id", aid)
      .eq("key", k)
      .maybeSingle();
    if (data) return data.value as T;
    return fb;
  } catch {
    return fb;
  }
}

export async function sSave(k: string, v: unknown, aid: string | null | undefined): Promise<void> {
  if (!aid) return;
  const { error } = await db.from("app_data").upsert(
    { athlete_id: aid, key: k, value: v, updated_at: new Date().toISOString() },
    { onConflict: "athlete_id,key" }
  );
  if (error) {
    console.error("sSave error", k, error.message, error.code);
    throw error;
  }
}

export function clearAllLocalStorage(): void {
  Object.values(SKEYS).forEach((k) => localStorage.removeItem(k));
}
