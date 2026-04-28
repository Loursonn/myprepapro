import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CalEventType = "workout" | "test" | "competition";

export interface CalEvent {
  id: string;
  title: string;
  date: string;           // ISO yyyy-MM-dd
  type: CalEventType;
  status?: string;        // workout: planned|completed|missed|skipped
  rpe?: number | null;
  raw: Record<string, unknown>;
}

// ── Query ─────────────────────────────────────────────────────────────────────

export function useCalendarEvents(athleteId: string, month: Date) {
  const start = format(startOfMonth(month), "yyyy-MM-dd");
  const end   = format(endOfMonth(month),   "yyyy-MM-dd");

  return useQuery({
    queryKey: ["calendar-events", athleteId, start],
    enabled: !!athleteId,
    staleTime: 30_000,
    queryFn: async (): Promise<CalEvent[]> => {
      const [wRes, tRes, cRes] = await Promise.all([
        // workout_logs + RPE
        supabase
          .from("workout_logs")
          .select("id, session_id, session_name, scheduled_date, status, workout_rpe(rpe_score)")
          .eq("athlete_id", athleteId)
          .gte("scheduled_date", start)
          .lte("scheduled_date", end)
          .order("scheduled_date"),

        // test_sessions
        supabase
          .from("test_sessions")
          .select("id, title, date, completed, type")
          .eq("athlete_id", athleteId)
          .gte("date", start)
          .lte("date", end)
          .order("date"),

        // competitions
        supabase
          .from("competitions")
          .select("id, name, date, priority")
          .eq("athlete_id", athleteId)
          .gte("date", start)
          .lte("date", end)
          .order("date"),
      ]);

      const events: CalEvent[] = [];

      // workouts
      for (const w of wRes.data ?? []) {
        const rpe = Array.isArray(w.workout_rpe) && w.workout_rpe.length > 0
          ? (w.workout_rpe[0] as { rpe_score: number }).rpe_score
          : null;
        events.push({
          id: w.id,
          title: w.session_name,
          date: w.scheduled_date,
          type: "workout",
          status: w.status,
          rpe,
          raw: { ...(w as Record<string, unknown>), session_id: w.session_id },
        });
      }

      // tests
      for (const t of tRes.data ?? []) {
        events.push({
          id: t.id,
          title: t.title,
          date: t.date,
          type: "test",
          status: t.completed ? "completed" : "planned",
          raw: t as Record<string, unknown>,
        });
      }

      // competitions
      for (const c of cRes.data ?? []) {
        events.push({
          id: c.id,
          title: c.name,
          date: c.date,
          type: "competition",
          raw: c as Record<string, unknown>,
        });
      }

      return events;
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useAssignWorkout() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      sessionName,
      athleteId,
      coachId,
      date,
    }: {
      sessionId: string;
      sessionName: string;
      athleteId: string;
      coachId: string;
      date: string;
    }) => {
      const { error } = await supabase.from("workout_logs").insert({
        athlete_id: athleteId,
        coach_id: coachId,
        session_id: sessionId,
        session_name: sessionName,
        scheduled_date: date,
        status: "planned",
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["calendar-events", vars.athleteId] });
      toast.success("Séance ajoutée");
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });
}

export function useCreateTestSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      athleteId,
      coachId,
      title,
      type,
      date,
    }: {
      athleteId: string;
      coachId: string;
      title: string;
      type: string;
      date: string;
    }) => {
      const { error } = await supabase.from("test_sessions").insert({
        athlete_id: athleteId,
        coach_id: coachId,
        title,
        type,
        date,
        completed: false,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["calendar-events", vars.athleteId] });
      toast.success("Test créé");
    },
    onError: () => toast.error("Erreur lors de la création"),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, type }: { id: string; type: CalEventType; athleteId: string }) => {
      const table = type === "workout" ? "workout_logs" : "test_sessions";
      if (type === "competition") return; // competitions managed elsewhere
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["calendar-events", vars.athleteId] });
      toast.success("Supprimé");
    },
  });
}
