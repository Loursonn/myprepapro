import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Trash2, Plus, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { C } from "@/lib/theme";
import type { CalEvent } from "@/features/shared/hooks/useUnifiedCalendar";
import { useDeleteCalendarEvent } from "@/features/shared/hooks/useUnifiedCalendar";
import { supabase } from "@/integrations/supabase/client";

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

const TYPE_COLOR: Record<CalEvent["type"], string> = {
  workout:     C.ac,
  test:        C.o,
  competition: C.coach,
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
            background: C.acS, color: C.ac,
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
  onSelect,
}: {
  event: CalEvent;
  athleteId: string;
  onSelect: (e: CalEvent) => void;
}) {
  const color = TYPE_COLOR[event.type];
  const { mutate: del } = useDeleteCalendarEvent();
  const statusInfo = event.status ? STATUS_LABEL[event.status] : null;

  return (
    <div
      onClick={() => event.type === "workout" && onSelect(event)}
      style={{
        background: C.s2,
        borderRadius: 12,
        borderLeft: `3px solid ${color}`,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: event.type === "workout" ? "pointer" : "default",
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
              {event.type === "workout" ? "Séance" : event.type === "test" ? "Test" : "Compétition"}
            </span>
            {statusInfo && (
              <span style={{ fontSize: 10, color: statusInfo.color }}>{statusInfo.label}</span>
            )}
            {event.rpe != null && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                background: C.acS, color: C.ac,
              }}>
                RPE {event.rpe}/10
              </span>
            )}
            {event.type === "workout" && (
              <span style={{ fontSize: 9, color: C.tx3, marginLeft: "auto" }}>Voir →</span>
            )}
          </div>
        </div>

        {event.type !== "competition" && (
          <button
            onClick={(ev) => { ev.stopPropagation(); del({ id: event.id, type: event.type, athleteId }); }}
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
  onQuickAdd: (day: Date) => void;
  exos?: Record<string, unknown[]>;
  sets?: Record<string, unknown[]>;
}

export function DayDetailsDrawer({
  open,
  onClose,
  day,
  events,
  athleteId,
  onQuickAdd,
  exos,
  sets,
}: DayDetailsDrawerProps) {
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  if (!open || !day) return null;

  const dayEvents = events.filter((e) => e.date === format(day, "yyyy-MM-dd"));
  const workouts     = dayEvents.filter((e) => e.type === "workout");
  const tests        = dayEvents.filter((e) => e.type === "test");
  const competitions = dayEvents.filter((e) => e.type === "competition");

  const handleClose = () => {
    setSelectedEvent(null);
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
            <WorkoutDetailView event={selectedEvent} exos={exos} localSets={sets} />
          ) : (
            <>
              {/* Competition banner — always at top if present */}
              {competitions.map((e) => (
                <div
                  key={e.id}
                  style={{
                    borderRadius: 14, overflow: "hidden",
                    border: "1px solid " + C.coach + "40",
                    background: "linear-gradient(135deg, rgba(244,114,182,0.12) 0%, rgba(244,114,182,0.05) 100%)",
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
                  </div>
                </div>
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
                      <EventCard key={e.id} event={e} athleteId={athleteId} onSelect={setSelectedEvent} />
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
                      <EventCard key={e.id} event={e} athleteId={athleteId} onSelect={setSelectedEvent} />
                    ))}
                  </div>
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
    </>
  );
}
