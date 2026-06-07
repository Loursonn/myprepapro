import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { C } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useWorkoutDetail } from "@/features/shared/hooks/useWorkoutDetail";
import { useUpdateSet } from "@/features/shared/hooks/useUpdateSet";
import { useCompleteWorkout } from "@/features/shared/hooks/useCompleteWorkout";
import { useWorkoutLog } from "@/features/shared/hooks/useWorkoutLog";
import { useAddBonusSet } from "@/features/shared/hooks/useAddBonusSet";
import { useAddCustomExercise } from "@/features/shared/hooks/useAddCustomExercise";
import { usePRsByRef } from "@/features/shared/hooks/usePRLogs";
import { useAutoComputePRs, effectiveRmRef } from "@/features/shared/hooks/useAutoComputePRs";
import type { SetRow } from "@/features/shared/types/athlete";
import { RpeSheet } from "../components/RpeSheet";

function haptic() {
  if (navigator.vibrate) navigator.vibrate(10);
}

function localMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── Set row editor ────────────────────────────────────────────────────────────

interface SetEditorProps {
  setNum: number;
  set: SetRow;
  onChange: (s: SetRow) => void;
  isBonus?: boolean;
}

function SetEditor({ setNum, set, onChange, isBonus }: SetEditorProps) {
  const doneColor = set.done ? C.g : C.tx3;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 0", borderBottom: "1px solid " + C.brd,
        background: isBonus ? "rgba(245,158,11,0.04)" : "transparent",
      }}
    >
      {/* Done toggle */}
      <button
        onClick={() => { onChange({ ...set, done: !set.done }); haptic(); }}
        style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          border: "1px solid " + (set.done ? C.g + "50" : isBonus ? "#F59E0B50" : C.brdL),
          background: set.done ? C.gS : "transparent",
          color: doneColor, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center",
          minWidth: 44, minHeight: 44,
        }}
      >
        {set.done ? "✓" : isBonus ? "+" : setNum}
      </button>

      {/* Kg */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, color: C.tx3, marginBottom: 2 }}>Kg</div>
        <input
          type="number" inputMode="decimal"
          value={set.kg ?? ""}
          onChange={(e) => onChange({ ...set, kg: Number(e.target.value) || undefined })}
          style={{
            width: "100%", background: C.s2, border: "1px solid " + C.brdL,
            borderRadius: 8, padding: "6px 8px",
            color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none",
          }}
          placeholder="—"
        />
      </div>

      {/* Reps */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, color: C.tx3, marginBottom: 2 }}>Reps</div>
        <input
          type="number" inputMode="numeric"
          value={set.reps ?? ""}
          onChange={(e) => onChange({ ...set, reps: Number(e.target.value) || undefined })}
          style={{
            width: "100%", background: C.s2, border: "1px solid " + C.brdL,
            borderRadius: 8, padding: "6px 8px",
            color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none",
          }}
          placeholder="—"
        />
      </div>

      {/* RIR */}
      <div style={{ width: 48 }}>
        <div style={{ fontSize: 9, color: C.tx3, marginBottom: 2 }}>RIR</div>
        <input
          type="number" inputMode="numeric" min={0} max={5}
          value={set.rir ?? ""}
          onChange={(e) => onChange({ ...set, rir: Number(e.target.value) })}
          style={{
            width: "100%", background: C.s2, border: "1px solid " + C.brdL,
            borderRadius: 8, padding: "6px 8px",
            color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none",
          }}
          placeholder="—"
        />
      </div>
    </div>
  );
}

// ── Exercise picker modal ──────────────────────────────────────────────────────

interface ExercisePickerProps {
  onSelect: (ex: { id: string; name: string; ex_type?: string }) => void;
  onClose: () => void;
}

function ExercisePicker({ onSelect, onClose }: ExercisePickerProps) {
  const [search, setSearch] = useState("");

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ["exercises-picker", search],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("exercises")
        .select("id, name, ex_type, bloc")
        .order("name")
        .limit(40);
      if (search.trim()) {
        q = q.ilike("name", `%${search.trim()}%`);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <Drawer open onOpenChange={(v) => !v && onClose()}>
      <DrawerContent style={{ background: C.s1, borderTop: "1px solid " + C.brd, padding: "0 0 32px", maxHeight: "80vh" }}>
        <DrawerHeader style={{ padding: "16px 20px 8px" }}>
          <DrawerTitle style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>
            Ajouter un exercice
          </DrawerTitle>
        </DrawerHeader>

        <div style={{ padding: "0 20px 8px" }}>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un exercice…"
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: "1px solid " + C.brdL, background: C.s2,
              color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ overflowY: "auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: 4 }}>
          {isLoading ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: C.tx3, fontSize: 12 }}>
              Chargement…
            </div>
          ) : exercises.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: C.tx3, fontSize: 12 }}>
              Aucun exercice trouvé
            </div>
          ) : (
            exercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => { haptic(); onSelect({ id: ex.id, name: ex.name ?? "", ex_type: ex.ex_type ?? undefined }); }}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1px solid " + C.brd, background: C.s2,
                  display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.tx }}>{ex.name}</div>
                  {ex.bloc && <div style={{ fontSize: 10, color: C.tx3, marginTop: 1 }}>{ex.bloc}</div>}
                </div>
                <span style={{ fontSize: 11, color: C.ac }}>+ Ajouter</span>
              </button>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ── Bonus set section (below each exercise) ───────────────────────────────────

interface BonusSetSectionProps {
  exerciseId: string;
  exerciseName: string;
  workoutLogId: string;
  athleteId: string;
  weekMondayISO: string;
  existingSets: SetRow[];
}

function BonusSetSection({
  exerciseId, exerciseName, workoutLogId, athleteId, weekMondayISO, existingSets,
}: BonusSetSectionProps) {
  const [localSets, setLocalSets] = useState<SetRow[]>(existingSets);
  const { mutate: addBonus, isPending } = useAddBonusSet();

  // Keep local state in sync when props change (e.g. after successful save)
  useEffect(() => { setLocalSets(existingSets); }, [existingSets]);

  function handleAddSet() {
    const newSet: SetRow = {};
    const updated = [...localSets, newSet];
    setLocalSets(updated);
    addBonus({
      workoutLogId, athleteId, exerciseId, exerciseName,
      set: newSet, weekMondayISO,
    });
  }

  if (localSets.length === 0) {
    return (
      <button
        onClick={() => { haptic(); handleAddSet(); }}
        disabled={isPending}
        style={{
          width: "100%", padding: "8px 14px", borderRadius: "0 0 10px 10px",
          border: "none", borderTop: "1px dashed " + C.brdL,
          background: "rgba(245,158,11,0.06)", color: "#F59E0B",
          fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        + Série bonus
      </button>
    );
  }

  return (
    <div>
      <div style={{ padding: "4px 14px", borderTop: "1px dashed " + "#F59E0B30" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>
          Séries bonus athlète
        </div>
        {localSets.map((s, i) => (
          <SetEditor
            key={i}
            setNum={i + 1}
            set={s}
            isBonus
            onChange={(newSet) => {
              const updated = [...localSets];
              updated[i] = newSet;
              setLocalSets(updated);
            }}
          />
        ))}
      </div>
      <button
        onClick={() => { haptic(); handleAddSet(); }}
        disabled={isPending}
        style={{
          width: "100%", padding: "7px 14px",
          border: "none", borderTop: "1px dashed " + C.brdL,
          background: "rgba(245,158,11,0.04)", color: "#F59E0B",
          fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        + Série bonus
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { athleteId, sets: setsMap } = useAthleteContext();

  const { session, exercises, isCompleted, currentWeek } = useWorkoutDetail(id ?? "");
  const { mutate: updateSet } = useUpdateSet();
  const { mutate: completeWorkoutBase } = useCompleteWorkout();
  const computePRs = useAutoComputePRs();

  const completeWorkout = useCallback((sessionId: string) => {
    completeWorkoutBase(sessionId);
    if (athleteId) {
      computePRs({
        athleteId,
        exercises: exercises.map(e => e.exercise),
        sets: setsMap,
        currentWeek,
      });
    }
  }, [completeWorkoutBase, computePRs, athleteId, exercises, setsMap, currentWeek]);
  const [showRpe, setShowRpe] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  const weekMondayISO = localMonday();

  const { data: workoutLog } = useWorkoutLog(athleteId ?? "", id ?? "");
  const { byRef: prByRef } = usePRsByRef(athleteId ?? undefined);

  const { mutate: addCustomEx } = useAddCustomExercise();
  const [customExercises, setCustomExercises] = useState<Array<{
    name: string; id: string; sets: SetRow[];
  }>>([]);

  // Sync custom exercises from persisted athlete_modifications
  useEffect(() => {
    if (workoutLog?.athleteModifications?.customExercises) {
      setCustomExercises(
        workoutLog.athleteModifications.customExercises.map((ce) => ({
          name: ce.name,
          id:   ce.tempId,
          sets: ce.sets as SetRow[],
        }))
      );
    }
  }, [workoutLog]);

  const canEditLive = !!workoutLog && !isCompleted;

  if (!session) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: C.tx3, fontSize: 13 }}>
        Séance introuvable
      </div>
    );
  }

  // Bonus sets from persisted modifications
  const bonusSetsMap = new Map<string, SetRow[]>(
    (workoutLog?.athleteModifications?.bonusSets ?? []).map((b) => [b.exerciseId, b.sets])
  );

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 120, scrollbarWidth: "none" }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
          borderBottom: "1px solid " + C.brd,
          position: "sticky", top: 45, background: C.bg, zIndex: 5,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            border: "1px solid " + C.brdL, background: "transparent",
            color: C.tx3, fontSize: 16, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44,
          }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: C.tx3 }}>{session.short}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.tx }}>{session.name}</div>
          {/* Badge décalée */}
          {workoutLog?.rescheduledByAthlete && workoutLog.originalScheduledDate !== workoutLog.scheduledDate && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 20, marginTop: 3,
              background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)",
              fontSize: 9, fontWeight: 700, color: "#F59E0B",
            }}>
              ⏱ Décalée du {new Date(workoutLog.originalScheduledDate + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </div>
          )}
        </div>
        {isCompleted && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: C.gS, color: C.g }}>
            ✓ Complétée
          </span>
        )}
      </div>

      {/* Exercises */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {exercises.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: C.tx3, fontSize: 12 }}>
            Aucun exercice dans cette séance
          </div>
        ) : (
          exercises.map(({ exercise, sets, prevSets, prevWeekNum }) => {
            const wk = exercise.weeks?.[currentWeek] ?? exercise.weeks?.[1];
            const exSets = sets.length > 0
              ? sets
              : Array.from({ length: wk?.sets ?? 3 }, (): SetRow => ({}));
            const bonusSets = bonusSetsMap.get(exercise.id) ?? [];

            // Method reference weight calculation (from kg on the exercise)
            const methodRef = wk?.method_attachment?.reference;
            const methodRefKg = (() => {
              if (!methodRef || !wk?.kg) return null;
              const m = methodRef.trim().match(/^(\d+(?:\.\d+)?)%$/);
              if (!m) return null;
              return Math.round(parseFloat(m[1]) / 100 * wk.kg * 2) / 2;
            })();

            // %RM programming: derive kg from athlete PR
            const pctRm = wk?.pct_rm;
            const rmRef = effectiveRmRef(exercise); // rm_ref ou nom de l'exercice
            const rmKg = (() => {
              if (pctRm == null || !rmRef) return null;
              const prs = prByRef[rmRef];
              if (!prs?.length) return null;
              const best = prs.reduce((m, p) => p.kg > m.kg ? p : m, prs[0]);
              return Math.round(pctRm / 100 * best.kg * 2) / 2;
            })();

            return (
              <div
                key={exercise.id}
                style={{
                  background: C.s1, borderRadius: 14,
                  border: "1px solid " + C.brd, overflow: "hidden",
                }}
              >
                {/* Exercise header */}
                <div style={{ padding: "12px 14px", borderBottom: "1px solid " + C.brd }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{exercise.name}</div>
                  {exercise.bloc && (
                    <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>{exercise.bloc}</div>
                  )}
                  {/* %RM badge */}
                  {pctRm != null && (
                    <div style={{
                      marginTop: 8, padding: "6px 10px", borderRadius: 8,
                      background: `${C.g}12`, border: `1px solid ${C.g}30`,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.g }}>%RM</span>
                      <span style={{ fontSize: 10, color: C.tx3 }}>{rmRef ?? "—"}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.tx, marginLeft: "auto" }}>
                        {pctRm}%
                        {rmKg != null ? ` → ${rmKg} kg` : <span style={{ fontSize: 10, color: C.o }}> (aucun PR)</span>}
                      </span>
                    </div>
                  )}

                  {/* Method badge */}
                  {wk?.method_attachment && (
                    <div style={{
                      marginTop: 8, padding: "6px 10px", borderRadius: 8,
                      background: `${C.ac}12`, border: `1px solid ${C.ac}30`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.ac }}>
                          {wk.method_attachment.method_name ?? "Méthode"}
                        </span>
                        {wk.method_attachment.applied_to_sets && wk.method_attachment.applied_to_sets.length > 0 && (
                          <span style={{ fontSize: 10, color: C.tx3 }}>
                            · sets {wk.method_attachment.applied_to_sets.join(", ")}
                          </span>
                        )}
                        {methodRefKg !== null && (
                          <span style={{ fontSize: 11, fontWeight: 800, color: C.tx, marginLeft: "auto" }}>
                            {methodRef} → {methodRefKg} kg
                          </span>
                        )}
                      </div>
                      {wk.method_attachment.prescription && (
                        <div style={{ fontSize: 10, color: C.tx2, marginTop: 4, fontFamily: "monospace" }}>
                          {wk.method_attachment.prescription}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Prescribed sets */}
                {/* Previous session */}
                {prevWeekNum !== null && (
                  <div style={{
                    padding: "8px 14px",
                    borderBottom: "1px solid " + C.brd,
                    background: C.s2,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.tx3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      ↩ Sem. {prevWeekNum}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {prevSets.map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.tx2 }}>
                          <span style={{ fontSize: 10, color: C.tx3, minWidth: 18 }}>S{i + 1}</span>
                          <span style={{ fontWeight: 600, color: C.tx }}>
                            {s.kg != null ? `${s.kg} kg` : "—"}
                          </span>
                          <span style={{ color: C.tx3 }}>×</span>
                          <span style={{ fontWeight: 600, color: C.tx }}>
                            {s.reps != null ? `${s.reps}` : "—"}
                          </span>
                          {s.rir != null && (
                            <span style={{ fontSize: 10, color: C.tx3, marginLeft: 2 }}>
                              · RIR {s.rir}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sets */}
                <div style={{ padding: "0 14px" }}>
                  {exSets.map((s, i) => (
                    <SetEditor
                      key={i}
                      setNum={i + 1}
                      set={s}
                      onChange={(newSet) => {
                        const key = `${exercise.id}_${1}`;
                        const newSets = [...exSets];
                        newSets[i] = newSet;
                        updateSet(key, newSets);
                      }}
                    />
                  ))}
                </div>

                {/* Bonus sets section */}
                {canEditLive && workoutLog && (
                  <BonusSetSection
                    exerciseId={exercise.id}
                    exerciseName={exercise.name}
                    workoutLogId={workoutLog.id}
                    athleteId={athleteId ?? ""}
                    weekMondayISO={weekMondayISO}
                    existingSets={bonusSets}
                  />
                )}
              </div>
            );
          })
        )}

        {/* Custom exercises added by athlete */}
        {customExercises.map((ce) => (
          <div
            key={ce.id}
            style={{
              background: C.s1, borderRadius: 14,
              border: "1px solid rgba(245,158,11,0.3)", overflow: "hidden",
            }}
          >
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(245,158,11,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                Ajouté athlète
              </span>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{ce.name}</div>
            </div>
            <div style={{ padding: "0 14px" }}>
              {ce.sets.map((s, i) => (
                <SetEditor
                  key={i}
                  setNum={i + 1}
                  set={s}
                  isBonus
                  onChange={(newSet) => {
                    setCustomExercises((prev) =>
                      prev.map((x) => x.id === ce.id
                        ? { ...x, sets: x.sets.map((ss, ii) => ii === i ? newSet : ss) }
                        : x
                      )
                    );
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        {/* + Exercice button */}
        {canEditLive && workoutLog && (
          <button
            onClick={() => { haptic(); setShowExercisePicker(true); }}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 12,
              border: "1.5px dashed " + "#F59E0B50", background: "rgba(245,158,11,0.05)",
              color: "#F59E0B", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", minHeight: 44,
            }}
          >
            + Exercice
          </button>
        )}
      </div>

      {/* Sticky "Terminer" button */}
      <div
        style={{
          position: "fixed", bottom: 64, left: 0, right: 0, zIndex: 20,
          padding: "12px 16px",
          background: "linear-gradient(transparent, " + C.bg + " 30%)",
          display: "flex", justifyContent: "center",
        }}
      >
        <button
          onClick={() => {
            if (!isCompleted) {
              completeWorkout(session.id);
              setShowRpe(true);
            }
          }}
          disabled={isCompleted}
          style={{
            width: "100%", maxWidth: 480, padding: "16px 0", borderRadius: 16,
            border: "none",
            background: isCompleted ? C.s2 : C.coach,
            color: isCompleted ? C.tx3 : "#fff",
            fontSize: 14, fontWeight: 700, cursor: isCompleted ? "default" : "pointer",
            fontFamily: "inherit", minHeight: 44,
            boxShadow: isCompleted ? "none" : "0 4px 20px rgba(168,85,247,0.35)",
          }}
        >
          {isCompleted ? "Séance déjà complétée ✓" : "Terminer la séance 🏁"}
        </button>
      </div>

      {showRpe && session && (
        <RpeSheet
          sessionId={session.id}
          onClose={() => { setShowRpe(false); navigate(-1); }}
        />
      )}

      {/* Exercise picker */}
      {showExercisePicker && workoutLog && (
        <ExercisePicker
          onClose={() => setShowExercisePicker(false)}
          onSelect={(ex) => {
            setShowExercisePicker(false);
            const newEntry = { name: ex.name, id: "local_" + Date.now(), sets: [{}] as SetRow[] };
            setCustomExercises((prev) => [...prev, newEntry]);
            addCustomEx({
              workoutLogId:  workoutLog.id,
              athleteId:     athleteId ?? "",
              weekMondayISO,
              exercise: {
                name:       ex.name,
                exerciseId: ex.id,
                exType:     ex.ex_type,
                sets:       [{}],
              },
            });
          }}
        />
      )}
    </div>
  );
}
