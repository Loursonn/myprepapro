import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ProgSession } from "@/features/coach/components/programmation/types";

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function usePlaceSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      session,
      athleteId,
      coachId,
      date,
      cycleId,
    }: {
      session: ProgSession;
      athleteId: string;
      coachId: string;
      date: string;
      cycleId?: string;
    }) => {
      const shouldRecur =
        session.recurrence === "weekly" &&
        session.day_of_week !== undefined &&
        !!cycleId;

      if (shouldRecur) {
        const { data: micros } = await supabase
          .from("microcycles")
          .select("id, week_number, start_date, end_date")
          .eq("cycle_id", cycleId!)
          .order("week_number");

        if (micros && micros.length > 0) {
          const today = new Date().toISOString().slice(0, 10);
          const logs = micros
            .filter((micro) => micro.end_date >= today)
            .map((micro) => {
              const weekStart = new Date(micro.start_date + "T12:00:00");
              const targetDate = new Date(weekStart);
              targetDate.setDate(weekStart.getDate() + (session.day_of_week ?? 0));
              const dateStr = localISO(targetDate);
              return {
                athlete_id: athleteId,
                coach_id: coachId,
                session_id: session.id,
                session_name: session.name,
                scheduled_date: dateStr,
                original_scheduled_date: dateStr,
                status: "planned",
                microcycle_id: micro.id,
              };
            });

          if (logs.length > 0) {
            const { error } = await supabase.from("workout_logs").insert(logs);
            if (error) throw error;
          }
          return;
        }
      }

      // Single placement
      const { error } = await supabase.from("workout_logs").insert({
        athlete_id: athleteId,
        coach_id: coachId,
        session_id: session.id,
        session_name: session.name,
        scheduled_date: date,
        original_scheduled_date: date,
        status: "planned",
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["workout-logs-week"] });
      qc.invalidateQueries({ queryKey: ["active-plan", vars.athleteId] });
      toast.success("Séance placée dans le planning ✓");
    },
    onError: () => toast.error("Erreur lors du placement"),
  });
}
