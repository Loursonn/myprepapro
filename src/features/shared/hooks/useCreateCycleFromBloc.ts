import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { BlockConfig, Session } from "@/features/shared/types/athlete";

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Returns the Monday of the week containing `dateStr`. */
function toMonday(dateStr: string): Date {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface Params {
  blockConfig: BlockConfig;
  sessions:    Session[];
  athleteId:   string;
  coachId:     string;
}

export function useCreateCycleFromBloc() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ blockConfig, sessions, athleteId, coachId }: Params) => {
      if (!blockConfig.startDate) throw new Error("Le bloc n'a pas de date de début.");

      const tw       = blockConfig.totalWeeks || 6;
      const monday   = toMonday(blockConfig.startDate);
      const endDate  = addDays(monday, tw * 7 - 1);

      // ── 1. Créer le cycle ────────────────────────────────────────────────────
      const { data: cycle, error: cycleErr } = await supabase
        .from("cycles")
        .insert({
          name:        blockConfig.blockName || "Cycle",
          start_date:  localISO(monday),
          end_date:    localISO(endDate),
          athlete_id:  athleteId,
          coach_id:    coachId,
          // mesocycle_id intentionnellement null (cycle standalone)
        })
        .select("id")
        .single();

      if (cycleErr) throw cycleErr;

      // ── 2. Créer les microcycles (1 par semaine) ─────────────────────────────
      const microInserts = Array.from({ length: tw }, (_, i) => {
        const wStart = addDays(monday, i * 7);
        const wEnd   = addDays(wStart, 6);
        return {
          cycle_id:    cycle.id,
          week_number: i + 1,
          start_date:  localISO(wStart),
          end_date:    localISO(wEnd),
          is_deload:   (i + 1) === (blockConfig.deloadWeek || 0),
        };
      });

      const { data: micros, error: microErr } = await supabase
        .from("microcycles")
        .insert(microInserts)
        .select("id, week_number, start_date");

      if (microErr) throw microErr;

      // ── 3. Créer les workout_logs (1 par séance × semaine) ─────────────────
      const workoutLogs: Record<string, unknown>[] = [];

      for (const micro of micros ?? []) {
        const weekMonday = new Date(micro.start_date + "T12:00:00");

        for (const sess of sessions) {
          if (sess.day_of_week == null) continue;
          // day_of_week: 0=Lun, 1=Mar, ..., 6=Dim
          const sessionDate = addDays(weekMonday, sess.day_of_week);

          workoutLogs.push({
            athlete_id:     athleteId,
            coach_id:       coachId,
            session_id:     sess.id,
            session_name:   sess.name || sess.short || "Séance",
            scheduled_date: localISO(sessionDate),
            status:         "planned",
            microcycle_id:  micro.id,
          });
        }
      }

      if (workoutLogs.length > 0) {
        const { error: logsErr } = await supabase
          .from("workout_logs")
          .upsert(workoutLogs as never, { onConflict: "athlete_id,session_id,scheduled_date" });
        if (logsErr) throw logsErr;
      }

      return cycle;
    },

    onSuccess: () => {
      toast.success("Cycle créé depuis le bloc !");
      qc.invalidateQueries({ queryKey: ["timeline-data"] });
      qc.invalidateQueries({ queryKey: ["cal-range"] });
      qc.invalidateQueries({ queryKey: ["active-cycle"] });
    },

    onError: (err: Error) => {
      toast.error("Erreur création cycle : " + err.message);
    },
  });
}
