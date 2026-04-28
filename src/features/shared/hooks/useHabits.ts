import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hAddDays } from "@/lib/date";
import type { Habit } from "../types/athlete";

/**
 * Loads habits + habit_logs for the given athlete.
 * Uses direct Supabase calls (React Query would work here too but the
 * mutation pattern for toggleHabitLog is handled in useAthleteLogic).
 */
export function useHabits(athleteId: string) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<Record<string, string[]>>({});
  const [habitEnabled, setHabitEnabled] = useState(false);
  const [habitToggling, setHabitToggling] = useState(false);
  const [habitToggleErr, setHabitToggleErr] = useState("");

  useEffect(() => {
    if (!athleteId) return;
    supabase.from('habits').select('*')
      .eq('athlete_id', athleteId).eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false } as never)
      .then(({ data }) => { if (data) setHabits(data as Habit[]); });

    const cutoff = hAddDays(new Date(), -365).toISOString().slice(0, 10);
    supabase.from('habit_logs').select('habit_id,date')
      .eq('athlete_id', athleteId).gte('date', cutoff)
      .then(({ data }) => {
        if (data) {
          const l: Record<string, string[]> = {};
          data.forEach((r: { habit_id: string; date: string }) => {
            if (!l[r.habit_id]) l[r.habit_id] = [];
            l[r.habit_id].push(r.date);
          });
          setHabitLogs(l);
        }
      });

    supabase.from('profiles').select('habit_tracker_enabled')
      .eq('id', athleteId).single()
      .then(({ data }) => { if (data) setHabitEnabled(!!(data as { habit_tracker_enabled?: boolean }).habit_tracker_enabled); });
  }, [athleteId]);

  const toggleHabitEnabled = async () => {
    setHabitToggling(true);
    setHabitToggleErr('');
    const ne = !habitEnabled;
    setHabitEnabled(ne);
    const { error } = await supabase.from('profiles').update({ habit_tracker_enabled: ne }).eq('id', athleteId);
    if (error) {
      setHabitEnabled(!ne);
      setHabitToggleErr('Erreur : migration SQL non appliquée ?');
      console.error('habit toggle:', error);
    }
    setHabitToggling(false);
  };

  return { habits, setHabits, habitLogs, setHabitLogs, habitEnabled, setHabitEnabled, habitToggling, habitToggleErr, toggleHabitEnabled };
}
