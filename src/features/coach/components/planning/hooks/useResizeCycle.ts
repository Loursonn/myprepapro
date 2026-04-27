import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AnyItem, Level, TimelineData } from "./useTimelineData";

// Re-export types to avoid circular imports
export type { AnyItem, Level };

interface ResizeVars {
  level:      "macrocycles" | "mesocycles" | "cycles" | "microcycles";
  item:       { id: string; start_date: string; end_date: string };
  newStart:   Date;
  newEnd:     Date;
  parentStart?: string;
  parentEnd?:   string;
  athleteId:  string;
  rangeStart: string;
  rangeEnd:   string;
}

const LEVEL_LABEL: Record<string, string> = {
  macrocycles: "Macrocycle",
  mesocycles:  "Mésocycle",
  cycles:      "Cycle",
  microcycles: "Microcycle",
};

export function useResizeCycle() {
  const qc = useQueryClient();

  return useMutation({
    onMutate: async (vars: ResizeVars) => {
      const qKey = ["timeline-data", vars.athleteId, vars.rangeStart, vars.rangeEnd];
      await qc.cancelQueries({ queryKey: qKey });
      const previous = qc.getQueryData<TimelineData>(qKey);

      if (previous) {
        const ns = format(vars.newStart, "yyyy-MM-dd");
        const ne = format(vars.newEnd,   "yyyy-MM-dd");
        qc.setQueryData<TimelineData>(qKey, (old) => {
          if (!old) return old;
          return {
            ...old,
            [vars.level]: (old[vars.level] as Array<{ id: string }>).map((it) =>
              it.id === vars.item.id ? { ...it, start_date: ns, end_date: ne } : it,
            ),
          };
        });
      }

      return { previous, qKey };
    },

    mutationFn: async (vars: ResizeVars) => {
      // Parent constraint: revert if out of bounds
      if (vars.parentStart && vars.parentEnd) {
        const pStart = parseISO(vars.parentStart);
        const pEnd   = parseISO(vars.parentEnd);
        if (vars.newStart < pStart || vars.newEnd > pEnd) {
          throw new Error(`${LEVEL_LABEL[vars.level] ?? vars.level} dépasse les bornes du parent`);
        }
      }

      const { error } = await supabase
        .from(vars.level)
        .update({
          start_date: format(vars.newStart, "yyyy-MM-dd"),
          end_date:   format(vars.newEnd,   "yyyy-MM-dd"),
        })
        .eq("id", vars.item.id);
      if (error) throw error;
    },

    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous && ctx.qKey) {
        qc.setQueryData(ctx.qKey, ctx.previous);
      }
      toast.error(err.message ?? "Erreur redimensionnement");
    },

    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["timeline-data", vars.athleteId] });
    },
  });
}
