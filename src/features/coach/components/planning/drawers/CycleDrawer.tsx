import { useState } from "react";
import { format, parseISO, differenceInWeeks, eachDayOfInterval, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Edit3, Check, CheckCircle2, Clock, Circle } from "lucide-react";
import { C } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Cycle, Mesocycle } from "../hooks/useTimelineData";

// ── Session list ──────────────────────────────────────────────────────────────

interface WorkoutRow {
  id: string;
  session_name: string;
  scheduled_date: string;
  status: string;
  rpe: number | null;
}

function useCycleSessions(athleteId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["cycle-sessions", athleteId, startDate, endDate],
    enabled:  !!athleteId && !!startDate && !!endDate,
    staleTime: 60_000,
    queryFn: async (): Promise<WorkoutRow[]> => {
      const { data } = await supabase
        .from("workout_logs")
        .select("id, session_name, scheduled_date, status, workout_rpe(rpe_score)")
        .eq("athlete_id", athleteId)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .order("scheduled_date");

      return (data ?? []).map((w) => ({
        id:             w.id,
        session_name:   w.session_name,
        scheduled_date: w.scheduled_date,
        status:         w.status,
        rpe:            Array.isArray(w.workout_rpe) && w.workout_rpe.length > 0
          ? (w.workout_rpe[0] as { rpe_score: number }).rpe_score
          : null,
      }));
    },
  });
}

// ── Status icon ───────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  if (status === "completed")
    return <CheckCircle2 size={13} style={{ color: C.g, flexShrink: 0 }} />;
  if (status === "skipped")
    return <Circle size={13} style={{ color: C.r, flexShrink: 0 }} />;
  return <Clock size={13} style={{ color: C.tx3, flexShrink: 0 }} />;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  cycle:          Cycle;
  parentMeso?:    Mesocycle;
  athleteId:      string;
  rangeStart:     string;
  rangeEnd:       string;
}

export function CycleDrawer({ cycle, parentMeso, athleteId, rangeStart, rangeEnd }: Props) {
  const qc = useQueryClient();
  const { data: sessions = [], isLoading: loadingSessions } = useCycleSessions(
    athleteId, cycle.start_date, cycle.end_date,
  );

  const [editingObj, setEditingObj] = useState(false);
  const [objective,  setObjective]  = useState(cycle.objective ?? "");

  const numWeeks = Math.max(1, differenceInWeeks(parseISO(cycle.end_date), parseISO(cycle.start_date)) + 1);

  const completed = sessions.filter((s) => s.status === "completed").length;
  const total     = sessions.length;
  const avgRpe    = sessions.filter((s) => s.rpe != null).length > 0
    ? (sessions.reduce((sum, s) => sum + (s.rpe ?? 0), 0) / sessions.filter((s) => s.rpe != null).length).toFixed(1)
    : null;

  async function saveObjective() {
    const { error } = await supabase
      .from("cycles")
      .update({ objective })
      .eq("id", cycle.id);
    if (error) { toast.error("Erreur"); return; }
    qc.invalidateQueries({ queryKey: ["timeline-data", athleteId, rangeStart, rangeEnd] });
    setEditingObj(false);
    toast.success("Objectif enregistré");
  }

  // Month for calendar link
  const calMonth = cycle.start_date.slice(0, 7);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Dates + duration */}
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { label: "Début", val: format(parseISO(cycle.start_date), "d MMM", { locale: fr }) },
          { label: "Fin",   val: format(parseISO(cycle.end_date),   "d MMM", { locale: fr }) },
          { label: "Durée", val: `${numWeeks} sem.` },
        ].map(({ label, val }) => (
          <div key={label} style={{ flex: 1, background: C.s2, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 9, color: C.tx3 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Parent meso objective (context) */}
      {parentMeso?.objective && (
        <div style={{ background: C.coachS, borderRadius: 8, padding: "10px 12px", border: "1px solid " + C.coach + "30" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.coach, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>
            Obj. Mésocycle parent
          </div>
          <div style={{ fontSize: 12, color: C.tx2 }}>{parentMeso.objective}</div>
        </div>
      )}

      {/* Objectif */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px" }}>
            Objectif du cycle
          </span>
          <button
            onClick={() => editingObj ? saveObjective() : setEditingObj(true)}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, border: "1px solid " + (editingObj ? C.g + "60" : C.brdL), background: editingObj ? C.gS : "transparent", color: editingObj ? C.g : C.tx3, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >
            {editingObj ? <><Check size={11} /> Enregistrer</> : <><Edit3 size={11} /> Modifier</>}
          </button>
        </div>
        {editingObj ? (
          <textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            rows={3}
            autoFocus
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid " + C.o + "60", background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }}
          />
        ) : (
          <div style={{ background: objective ? C.oS : C.s2, borderRadius: 10, padding: "12px 14px", border: "1px solid " + (objective ? C.o + "30" : C.brd), fontSize: 13, color: objective ? C.tx : C.tx3 }}>
            {objective || "Aucun objectif défini"}
          </div>
        )}
      </div>

      {/* Stats bar */}
      {total > 0 && (
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Total séances", val: String(total) },
            { label: "Réalisées",     val: `${completed} / ${total}` },
            ...(avgRpe ? [{ label: "RPE moyen", val: avgRpe }] : []),
          ].map(({ label, val }) => (
            <div key={label} style={{ flex: 1, background: C.s2, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 9, color: C.tx3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Session list */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 }}>
          Séances
        </div>
        {loadingSessions ? (
          <div style={{ textAlign: "center", padding: "16px 0", color: C.tx3, fontSize: 12 }}>Chargement…</div>
        ) : total === 0 ? (
          <div style={{ textAlign: "center", padding: "16px 0", color: C.tx3, fontSize: 12 }}>Aucune séance planifiée sur cette période.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 8,
                  background: s.status === "completed" ? C.gS : C.s2,
                  border: "1px solid " + (s.status === "completed" ? C.g + "25" : C.brd),
                }}
              >
                <StatusIcon status={s.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.session_name}
                  </div>
                  <div style={{ fontSize: 10, color: C.tx3 }}>
                    {format(parseISO(s.scheduled_date), "EEE d MMM", { locale: fr })}
                  </div>
                </div>
                {s.rpe != null && (
                  <div style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: C.o }}>
                    RPE {s.rpe}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendar link */}
      <a
        href={`?view=month&month=${calMonth}`}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "11px 0", borderRadius: 10,
          border: "1px solid " + C.o + "40", background: C.oS,
          color: C.o, fontSize: 13, fontWeight: 700,
          textDecoration: "none", gap: 6,
        }}
      >
        → Ouvrir Calendrier Mois {format(parseISO(cycle.start_date), "MMMM yyyy", { locale: fr })}
      </a>
    </div>
  );
}
