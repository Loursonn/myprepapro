import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Trash2, Plus, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/lib/theme";
import type { CalEvent } from "@/features/shared/hooks/useUnifiedCalendar";
import { useDeleteCalendarEvent } from "@/features/shared/hooks/useUnifiedCalendar";
import { useEnergySession } from "@/features/shared/hooks/useEnergySessions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Competition } from "@/types/planning";
import type { WellnessData } from "@/features/shared/types/athlete";
import type { NutritionDailyLog } from "@/lib/nutrition";
import { CompetitionFormModal } from "./CompetitionFormModal";
import { SessionPreviewModal } from "@/features/coach/components/energy/SessionPreviewModal";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SetRow {
  id: string;
  exercise_id: string;
  set_num: number;
  kg: number | null;
  reps: number | null;
  rir: number | null;
  method: string | null;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function rpeColor(v: number) { return v <= 4 ? C.g : v <= 7 ? C.o : C.r; }
function rpeBg(v: number)    { return v <= 4 ? C.gS : v <= 7 ? C.oS : C.rS; }

const ENERGY_KIND_COLOR: Record<string, string> = {
  vo2: "#A855F7", tempo: "#3B8DF0", seuil: "#F59E0B",
  footing: "#10B981", fartlek: "#EF4444", autre: "#6B7280", custom: "#6B7280",
};
const ENERGY_KIND_LABEL: Record<string, string> = {
  vo2: "VO₂max", tempo: "Tempo", seuil: "Seuil",
  footing: "Footing", fartlek: "Fartlek", autre: "Autre", custom: "Custom",
};

function energyColor(event: CalEvent): string {
  return ENERGY_KIND_COLOR[event.sessionKind ?? ""] ?? "#A855F7";
}

const TYPE_COLOR: Record<CalEvent["type"], string> = {
  workout:     C.ac,
  test:        C.o,
  competition: C.coach,
  energy:      "#A855F7",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  planned:     { label: "Planifiée",  color: C.tx3 },
  in_progress: { label: "En cours",   color: C.b   },
  completed:   { label: "Complétée",  color: C.g   },
  missed:      { label: "Manquée",    color: C.r   },
  skipped:     { label: "Sautée",     color: C.o   },
};

// ── WorkoutDetailView ─────────────────────────────────────────────────────────

function WorkoutDetailView({
  event,
  exos,
  localSets,
}: {
  event: CalEvent;
  exos?: Record<string, unknown[]>;
  localSets?: Record<string, unknown[]>;
}) {
  const sessionId    = event.raw?.session_id as string | undefined;
  const isProjected  = event.raw?.source === "block_plan";
  const isCompleted  = event.status === "completed";
  const week         = event.raw?.week as number | undefined;
  // Real DB workout: show set_logs. Projected+completed: use local sets from app_data.
  const workoutLogId = !isProjected && isCompleted ? event.id : null;

  // Fetch set_logs for completed real workouts
  const { data: sets = [], isLoading: setsLoading } = useQuery({
    queryKey: ["workout-sets", workoutLogId],
    enabled: !!workoutLogId,
    staleTime: 60_000,
    queryFn: async (): Promise<SetRow[]> => {
      const { data } = await supabase
        .from("set_logs")
        .select("id, exercise_id, set_num, kg, reps, rir, method")
        .eq("workout_log_id", workoutLogId)
        .order("set_num");
      return (data ?? []) as SetRow[];
    },
  });

  // Build exercise name map from exos
  const allExosList = Object.values(exos ?? {}).flat() as Array<{ id: string; name: string }>;
  const exoById: Record<string, string> = {};
  for (const e of allExosList) { if (e.id) exoById[e.id] = e.name ?? e.id; }

  // Planned exercises for this session
  const plannedExos = (sessionId && exos ? exos[sessionId] ?? [] : []) as Array<{
    id: string; name: string; bloc?: string;
  }>;

  const statusInfo = event.status ? STATUS_LABEL[event.status] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Status badge */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {statusInfo && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
            background: statusInfo.color + "20", color: statusInfo.color,
            textTransform: "uppercase", letterSpacing: "0.4px",
          }}>
            {statusInfo.label}
          </span>
        )}
        {event.rpe != null && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
            background: rpeBg(event.rpe), color: rpeColor(event.rpe),
          }}>
            RPE {event.rpe}/10
          </span>
        )}
        {isProjected && (
          <span style={{
            fontSize: 10, padding: "3px 8px", borderRadius: 20,
            background: C.s2, color: C.tx3, fontStyle: "italic",
          }}>
            Prévu (programme)
          </span>
        )}
      </div>

      {/* Completed: show set_logs */}
      {workoutLogId && (
        setsLoading ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: C.tx3, fontSize: 12 }}>
            Chargement…
          </div>
        ) : sets.length === 0 && week && localSets && plannedExos.length > 0 ? (() => {
          // DB set_logs empty → fall back to app_data local sets
          const exosWithSets = plannedExos
            .map(ex => ({
              ex,
              rows: ((localSets[ex.id + "_" + week] ?? []) as Array<{ done?: boolean; kg?: number; reps?: number; rir?: number; method?: string }>)
                .filter(r => r.done),
            }))
            .filter(({ rows }) => rows.length > 0);
          if (exosWithSets.length === 0) return (
            <div style={{ textAlign: "center", padding: "20px 0", color: C.tx3, fontSize: 12, background: C.s2, borderRadius: 10 }}>
              Séance validée — séries non enregistrées
            </div>
          );
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {exosWithSets.map(({ ex, rows }) => (
                <div key={ex.id} style={{ background: C.s2, borderRadius: 10, border: "1px solid " + C.brd, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid " + C.brd, fontSize: 12, fontWeight: 700, color: C.tx }}>{ex.name ?? "Exercice"}</div>
                  <div style={{ padding: "6px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                    {rows.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: C.tx2 }}>
                        <span style={{ color: C.tx3, minWidth: 20, fontSize: 10 }}>S{i + 1}</span>
                        {s.kg != null && <span style={{ fontWeight: 700, color: C.tx }}>{s.kg} kg</span>}
                        {s.reps != null && <span>× {s.reps} rép.</span>}
                        {s.rir != null && <span style={{ color: C.tx3, fontSize: 10 }}>RIR {s.rir}</span>}
                        {s.method && s.method !== "normal" && (
                          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: C.coachS, color: C.coach, fontWeight: 600 }}>{s.method}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })() : sets.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "20px 0", color: C.tx3, fontSize: 12,
            background: C.s2, borderRadius: 10,
          }}>
            Aucune série enregistrée
          </div>
        ) : (() => {
          // Group sets by exercise_id
          const grouped: Record<string, SetRow[]> = {};
          for (const s of sets) {
            (grouped[s.exercise_id] ??= []).push(s);
          }
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(grouped).map(([exId, rows]) => (
                <div key={exId} style={{
                  background: C.s2, borderRadius: 10,
                  border: "1px solid " + C.brd,
                  overflow: "hidden",
                }}>
                  <div style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid " + C.brd,
                    fontSize: 12, fontWeight: 700, color: C.tx,
                  }}>
                    {exoById[exId] ?? "Exercice"}
                  </div>
                  <div style={{ padding: "6px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                    {rows.map((s, i) => (
                      <div key={s.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        fontSize: 11, color: C.tx2,
                      }}>
                        <span style={{ color: C.tx3, minWidth: 20, fontSize: 10 }}>S{i + 1}</span>
                        {s.kg != null && (
                          <span style={{ fontWeight: 700, color: C.tx }}>{s.kg} kg</span>
                        )}
                        {s.reps != null && (
                          <span>× {s.reps} rép.</span>
                        )}
                        {s.rir != null && (
                          <span style={{ color: C.tx3, fontSize: 10 }}>RIR {s.rir}</span>
                        )}
                        {s.method && s.method !== "normal" && (
                          <span style={{
                            fontSize: 9, padding: "1px 5px", borderRadius: 4,
                            background: C.coachS, color: C.coach, fontWeight: 600,
                          }}>
                            {s.method}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}

      {/* Non-DB: projected or missing workout log */}
      {!workoutLogId && (() => {
        if (plannedExos.length === 0) {
          return (
            <div style={{ textAlign: "center", padding: "20px 0", color: C.tx3, fontSize: 12, background: C.s2, borderRadius: 10 }}>
              Programme non chargé — ouvre la vue Programmation
            </div>
          );
        }

        // Completed projected: try local sets first
        if (isProjected && isCompleted) {
          const exosWithSets = week && localSets
            ? plannedExos
                .map(ex => ({
                  ex,
                  rows: ((localSets[ex.id + "_" + week] ?? []) as Array<{ done?: boolean; kg?: number; reps?: number; rir?: number; method?: string }>)
                    .filter(r => r.done),
                }))
                .filter(({ rows }) => rows.length > 0)
            : [];

          if (exosWithSets.length > 0) {
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {exosWithSets.map(({ ex, rows }) => (
                  <div key={ex.id} style={{ background: C.s2, borderRadius: 10, border: "1px solid " + C.brd, overflow: "hidden" }}>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid " + C.brd, fontSize: 12, fontWeight: 700, color: C.tx }}>
                      {ex.name ?? "Exercice"}
                    </div>
                    <div style={{ padding: "6px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                      {rows.map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: C.tx2 }}>
                          <span style={{ color: C.tx3, minWidth: 20, fontSize: 10 }}>S{i + 1}</span>
                          {s.kg != null && <span style={{ fontWeight: 700, color: C.tx }}>{s.kg} kg</span>}
                          {s.reps != null && <span>× {s.reps} rép.</span>}
                          {s.rir != null && <span style={{ color: C.tx3, fontSize: 10 }}>RIR {s.rir}</span>}
                          {s.method && s.method !== "normal" && (
                            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: C.coachS, color: C.coach, fontWeight: 600 }}>
                              {s.method}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          // Completed but no individual sets logged → show planned exercises
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: C.tx3, marginBottom: 4, fontStyle: "italic" }}>
                Séance validée — séries non enregistrées
              </div>
              {plannedExos.map((ex, i) => (
                <div key={ex.id ?? i} style={{ padding: "8px 12px", borderRadius: 8, background: C.s2, border: "1px solid " + C.brd, fontSize: 12, fontWeight: 600, color: C.tx }}>
                  {ex.name ?? "Exercice"}
                </div>
              ))}
            </div>
          );
        }

        // Planned (not completed): show exercise list
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 2 }}>
              Exercices prévus
            </div>
            {plannedExos.map((ex, i) => (
              <div key={ex.id ?? i} style={{ padding: "8px 12px", borderRadius: 8, background: C.s2, border: "1px solid " + C.brd, fontSize: 12, fontWeight: 600, color: C.tx }}>
                {ex.name ?? "Exercice"}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ── EventCard ─────────────────────────────────────────────────────────────────

function EventCard({
  event,
  athleteId,
  coachId,
  onSelect,
  onPreview,
}: {
  event: CalEvent;
  athleteId: string;
  coachId: string;
  onSelect: (e: CalEvent) => void;
  onPreview?: (e: CalEvent) => void;
}) {
  const isEnergy  = event.type === "energy";
  const color = isEnergy ? energyColor(event) : TYPE_COLOR[event.type];
  const { mutate: del } = useDeleteCalendarEvent();
  const statusInfo = event.status ? STATUS_LABEL[event.status] : null;
  const isClickable = event.type === "workout" || (event.type === "energy" && !!onPreview);

  const typeLabel =
    event.type === "workout"     ? "Séance"
    : event.type === "test"      ? "Test"
    : event.type === "energy"    ? (ENERGY_KIND_LABEL[event.sessionKind ?? ""] ?? "Énergie")
    : "Compétition";

  return (
    <div
      onClick={() => {
        if (!isClickable) return;
        if (event.type === "energy" && onPreview) { onPreview(event); return; }
        onSelect(event);
      }}
      style={{
        background: C.s2,
        borderRadius: 12,
        borderLeft: `3px solid ${color}`,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: isClickable ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.tx, marginBottom: 2 }}>
            {event.title}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.4px",
              textTransform: "uppercase", color,
            }}>
              {typeLabel}
            </span>
            {statusInfo && (
              <span style={{ fontSize: 10, color: statusInfo.color }}>{statusInfo.label}</span>
            )}
            {event.rpe != null && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                background: rpeBg(event.rpe), color: rpeColor(event.rpe),
              }}>
                RPE {event.rpe}/10
              </span>
            )}
            {isClickable && (
              <span style={{ fontSize: 9, color: C.tx3, marginLeft: "auto" }}>Voir →</span>
            )}
          </div>
        </div>

        {event.type !== "competition" && (
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              del({
                id:          event.id,
                type:        event.type,
                athleteId,
                coachId,
                sessionId:   event.raw?.session_id as string | undefined,
                sessionName: event.title,
                date:        event.date,
              });
            }}
            style={{
              width: 28, height: 28, borderRadius: 8,
              border: "1px solid " + C.r + "30", background: "transparent",
              color: C.r, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, opacity: 0.6,
            }}
            title="Supprimer"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── DayDetailsDrawer ──────────────────────────────────────────────────────────

interface DayDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  day: Date | null;
  events: CalEvent[];
  athleteId: string;
  coachId: string;
  onQuickAdd: (day: Date) => void;
  exos?: Record<string, unknown[]>;
  sets?: Record<string, unknown[]>;
  initialSelectedEvent?: CalEvent | null;
  wellnessHistory?: Record<string, WellnessData>;
  nutritionLog?: Record<string, unknown>;
}

// ── WellnessDayView ───────────────────────────────────────────────────────────

function WellnessDayView({ wellness }: { wellness: WellnessData }) {
  const score = Math.round(((wellness.fatigue ?? 3) + (wellness.sommeil ?? 3) + (wellness.stress ?? 3) + (wellness.energie ?? 3) + (wellness.doms ?? 3)) / 25 * 100);
  const color = score >= 80 ? "#22C993" : score >= 65 ? "#7BC67E" : score >= 50 ? C.o : score >= 35 ? "#F07030" : C.r;
  const label = score >= 80 ? "Optimal" : score >= 65 ? "Bon" : score >= 50 ? "Modéré" : score >= 35 ? "Fatigué" : "Surmenage";
  const metrics = [
    { k: "Récup.", v: wellness.fatigue }, { k: "Sommeil", v: wellness.sommeil },
    { k: "Sérén.", v: wellness.stress }, { k: "Énergie", v: wellness.energie }, { k: "Fraîch.", v: wellness.doms },
  ].filter((m): m is { k: string; v: number } => m.v != null);
  return (
    <div style={{ background: C.s2, borderRadius: 10, border: "1px solid " + C.brd, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: metrics.length > 0 ? 8 : 0 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color }}>{score}</span>
        <span style={{ fontSize: 9, color: C.tx3 }}>/100</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: color + "20", color }}>{label}</span>
        {wellness.poids != null && <span style={{ fontSize: 10, color: C.tx3, marginLeft: "auto" }}>⚖️ {wellness.poids} kg</span>}
      </div>
      {metrics.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px" }}>
          {metrics.map(({ k, v }) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 9, color: C.tx3 }}>{k}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.tx }}>{v}/5</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NutritionDayView ──────────────────────────────────────────────────────────

function NutritionDayView({ nutrition }: { nutrition: NutritionDailyLog }) {
  const { total_calories_consumed: kcal, active_calories: active, glucides_consumed: glucides, lipides_consumed: lipides, proteines_consumed: proteines } = nutrition;
  const hasMacros = glucides != null || lipides != null || proteines != null;
  return (
    <div style={{ background: C.s2, borderRadius: 10, border: "1px solid " + C.brd, padding: "10px 12px" }}>
      {kcal != null && (
        <div style={{ fontSize: 16, fontWeight: 800, color: C.tx, marginBottom: hasMacros ? 6 : 0 }}>
          {kcal} <span style={{ fontSize: 11, fontWeight: 400, color: C.tx3 }}>kcal</span>
          {active != null && <span style={{ fontSize: 10, color: C.tx3, fontWeight: 400, marginLeft: 8 }}>(dépense : {active} kcal)</span>}
        </div>
      )}
      {hasMacros && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px" }}>
          {proteines != null && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 9, color: C.tx3 }}>Prot.</span><span style={{ fontSize: 10, fontWeight: 700, color: "#3B8DF0" }}>{proteines}g</span></div>}
          {glucides != null && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 9, color: C.tx3 }}>Gluc.</span><span style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B" }}>{glucides}g</span></div>}
          {lipides != null && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 9, color: C.tx3 }}>Lip.</span><span style={{ fontSize: 10, fontWeight: 700, color: "#EF4444" }}>{lipides}g</span></div>}
        </div>
      )}
    </div>
  );
}

/** Fetches full EnergySessionRow when an energy event is selected. */
function EnergyEventPreview({ event, athleteId, onClose }: { event: CalEvent; athleteId: string; onClose: () => void }) {
  const sessionId = event.energySessionId ?? (event.raw?.energy_session_id as string | undefined);
  const { data: session, isLoading } = useEnergySession(sessionId);

  if (isLoading) {
    return (
      <>
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.65)" }} />
        <div style={{
          position: "fixed", top: "50%", left: "50%", zIndex: 61,
          transform: "translate(-50%, -50%)",
          width: 780, maxWidth: "96vw",
          background: C.s1, borderRadius: 16, border: "1px solid " + C.brd,
          padding: "40px", textAlign: "center", color: C.tx3, fontSize: 13,
        }}>
          Chargement…
        </div>
      </>
    );
  }
  if (!session) return null;
  return <SessionPreviewModal session={session} athleteId={athleteId} onClose={onClose} />;
}

export function DayDetailsDrawer({
  open,
  onClose,
  day,
  events,
  athleteId,
  coachId,
  onQuickAdd,
  exos,
  sets,
  initialSelectedEvent,
  wellnessHistory,
  nutritionLog,
}: DayDetailsDrawerProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(initialSelectedEvent ?? null);
  const [editingComp,   setEditingComp]   = useState<Competition | null>(null);
  const [energyPreview, setEnergyPreview] = useState<CalEvent | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    setSelectedEvent(initialSelectedEvent ?? null);
    setEnergyPreview(null);
  }, [day, initialSelectedEvent]);

  if (!open || !day) return null;

  const dateStr = format(day, "yyyy-MM-dd");
  const dayEvents = events.filter((e) => e.date === dateStr);
  const workouts     = dayEvents.filter((e) => e.type === "workout");
  const tests        = dayEvents.filter((e) => e.type === "test");
  const competitions = dayEvents.filter((e) => e.type === "competition");
  const energyEvents = dayEvents.filter((e) => e.type === "energy");

  const wKey = dateStr.replace(/-/g, "");
  const wellnessDay = (wellnessHistory?.[wKey] ?? wellnessHistory?.[dateStr]) ?? null;
  const nutritionDay = (nutritionLog?.[dateStr] ?? nutritionLog?.[wKey] ?? null) as NutritionDailyLog | null;

  const handleClose = () => {
    setSelectedEvent(null);
    setEnergyPreview(null);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.5)" }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 380, maxWidth: "90vw",
        background: C.s1,
        borderLeft: "1px solid " + C.brd,
        display: "flex", flexDirection: "column",
        animation: "slideIn 200ms ease-out",
      }}>
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid " + C.brd,
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          {selectedEvent && (
            <button
              onClick={() => setSelectedEvent(null)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: "1px solid " + C.brdL, background: "transparent",
                color: C.tx3, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.tx }}>
              {selectedEvent ? selectedEvent.title : format(day, "d MMMM yyyy", { locale: fr })}
            </div>
            <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>
              {selectedEvent
                ? format(day, "d MMMM yyyy", { locale: fr })
                : dayEvents.length === 0
                  ? "Aucun événement"
                  : `${dayEvents.length} événement${dayEvents.length > 1 ? "s" : ""}`}
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "1px solid " + C.brdL, background: "transparent",
              color: C.tx3, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "16px 20px",
          display: "flex", flexDirection: "column", gap: 20,
        }}>
          {selectedEvent ? (
            selectedEvent.type === "energy" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {selectedEvent.status && STATUS_LABEL[selectedEvent.status] && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                      background: STATUS_LABEL[selectedEvent.status].color + "20",
                      color: STATUS_LABEL[selectedEvent.status].color,
                      textTransform: "uppercase", letterSpacing: "0.4px",
                    }}>
                      {STATUS_LABEL[selectedEvent.status].label}
                    </span>
                  )}
                  {selectedEvent.sessionKind && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                      background: energyColor(selectedEvent) + "20",
                      color: energyColor(selectedEvent),
                    }}>
                      {ENERGY_KIND_LABEL[selectedEvent.sessionKind] ?? selectedEvent.sessionKind}
                    </span>
                  )}
                </div>
                {selectedEvent.raw?.notes && (
                  <div style={{ fontSize: 12, color: C.tx2, background: C.s2, borderRadius: 10, padding: "10px 12px" }}>
                    {String(selectedEvent.raw.notes)}
                  </div>
                )}
                <div style={{ textAlign: "center", padding: "20px 0", color: C.tx3, fontSize: 12 }}>
                  Séance énergétique — voir le planning calendrier pour les détails
                </div>
              </div>
            ) : (
              <WorkoutDetailView event={selectedEvent} exos={exos} localSets={sets} />
            )
          ) : (
            <>
              {/* Competition banner — clickable to edit */}
              {competitions.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setEditingComp(e.raw as unknown as Competition)}
                  style={{
                    width: "100%", borderRadius: 14, overflow: "hidden",
                    border: "1px solid " + C.coach + "40",
                    background: "linear-gradient(135deg, rgba(244,114,182,0.12) 0%, rgba(244,114,182,0.05) 100%)",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const,
                  }}
                >
                  <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>🏆</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.tx }}>{e.title}</div>
                      {e.raw?.location && (
                        <div style={{ fontSize: 11, color: C.tx3, marginTop: 1 }}>{String(e.raw.location)}</div>
                      )}
                    </div>
                    {e.raw?.priority && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                        background: "#F5A62320", color: "#F5A623",
                      }}>
                        Priorité {String(e.raw.priority)}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: C.tx3 }}>✎</span>
                  </div>
                </button>
              ))}

              {dayEvents.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: C.tx3, fontSize: 13 }}>
                  Journée libre
                </div>
              )}

              {workouts.length > 0 && (
                <section>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.ac, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                    Séances
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {workouts.map((e) => (
                      <EventCard key={e.id} event={e} athleteId={athleteId} coachId={coachId} onSelect={setSelectedEvent} />
                    ))}
                  </div>
                </section>
              )}

              {tests.length > 0 && (
                <section>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.o, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                    Tests
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {tests.map((e) => (
                      <EventCard key={e.id} event={e} athleteId={athleteId} coachId={coachId} onSelect={setSelectedEvent} />
                    ))}
                  </div>
                </section>
              )}

              {energyEvents.length > 0 && (
                <section>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#A855F7", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                    Séances énergétiques
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {energyEvents.map((e) => (
                      <EventCard key={e.id} event={e} athleteId={athleteId} coachId={coachId} onSelect={setSelectedEvent} onPreview={setEnergyPreview} />
                    ))}
                  </div>
                </section>
              )}

              {wellnessDay && (
                <section>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#22C993", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>❤️ Bien-être</div>
                  <WellnessDayView wellness={wellnessDay} />
                </section>
              )}

              {nutritionDay && (
                <section>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>🍽️ Nutrition</div>
                  <NutritionDayView nutrition={nutritionDay} />
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!selectedEvent && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid " + C.brd, flexShrink: 0 }}>
            <button
              onClick={() => { handleClose(); onQuickAdd(day); }}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 12,
                border: "1px solid " + C.ac + "40", background: C.acS,
                color: C.ac, fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <Plus size={15} />
              Ajouter séance / test
            </button>
          </div>
        )}
      </div>

      {/* Competition edit modal */}
      {editingComp && (
        <CompetitionFormModal
          athleteId={editingComp.athlete_id ?? athleteId}
          coachId={editingComp.coach_id ?? user?.id ?? ""}
          existing={editingComp}
          onClose={() => setEditingComp(null)}
        />
      )}

      {/* Energy session preview modal */}
      {energyPreview && (
        <EnergyEventPreview
          event={energyPreview}
          athleteId={athleteId}
          onClose={() => setEnergyPreview(null)}
        />
      )}
    </>
  );
}
