import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { C } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useWorkoutSession } from "@/features/shared/hooks/useWorkoutSession";
import { useSaveWorkoutSets } from "@/features/shared/hooks/useSaveWorkoutSets";
import type { AthleteModifications, SessionSetLog } from "@/features/shared/types/athlete";
import type { ExerciceParams } from "@/features/coach/components/programmation/types";

const VIOLET = "#7B6FFF";

function haptic() {
  if (navigator.vibrate) navigator.vibrate(10);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatPrescription(params: ExerciceParams): string {
  const nb = params.nb_series;

  if (params.cluster) {
    const c = params.cluster;
    const repsArr = Array.isArray(c.reps) ? c.reps : Array(c.nb_clusters).fill(5);
    const repsStr = repsArr.join("+");
    let s = `${nb}×(${repsStr} + ${c.recup_sec}s)`;
    const charge =
      params.charge.mode === "global" ? params.charge.value : null;
    if (charge != null && params.charge_unit !== "PDC")
      s += ` @ ${charge}${params.charge_unit}`;
    return s;
  }

  if (
    params.reps.mode === "par_serie" ||
    params.charge.mode === "par_serie"
  ) {
    const parts = Array.from({ length: nb }, (_, i) => {
      const r =
        params.reps.mode === "par_serie"
          ? params.reps.values[i]
          : params.reps.value;
      const c =
        params.charge.mode === "par_serie"
          ? params.charge.values[i]
          : params.charge.value;
      if (c != null && params.charge_unit !== "PDC")
        return `${r ?? "?"}@${c}${params.charge_unit}`;
      return String(r ?? "?");
    });
    return `${nb}× ${parts.join(" / ")}`;
  }

  const reps =
    params.reps.mode === "global" ? params.reps.value : "?";
  const chargeVal =
    params.charge_unit === "PDC"
      ? "PDC"
      : params.charge.mode === "global" && params.charge.value != null
      ? `${params.charge.value}${params.charge_unit}`
      : null;
  const rirVal =
    params.rir.mode === "global" && params.rir.value != null
      ? params.rir.value
      : null;

  let s = `${nb}×${reps}`;
  if (chargeVal) s += ` @ ${chargeVal}`;
  if (rirVal != null) s += ` · RIR ${rirVal}`;
  return s;
}

function getSetTarget(
  params: ExerciceParams,
  setIdx: number
): { reps?: number; kg?: number | null; rir?: number | null } {
  const reps =
    params.reps.mode === "par_serie"
      ? params.reps.values[setIdx]
      : params.reps.value;
  const kg =
    params.charge_unit !== "PDC"
      ? params.charge.mode === "par_serie"
        ? params.charge.values[setIdx]
        : params.charge.value
      : null;
  const rir =
    params.rir.mode === "par_serie"
      ? (params.rir.values as (number | null)[])[setIdx]
      : params.rir.value;
  return { reps, kg, rir };
}

function initSetsFromParams(params: ExerciceParams): SessionSetLog[] {
  return Array.from({ length: params.nb_series }, (_, i) => {
    const t = getSetTarget(params, i);
    return {
      done: false,
      kg: t.kg ?? undefined,
      reps: t.reps ?? undefined,
      rir: t.rir != null ? t.rir : undefined,
    };
  });
}

// ── Set row editor ─────────────────────────────────────────────────────────────

interface SetEditorProps {
  setNum: number;
  set: SessionSetLog;
  target: { reps?: number; kg?: number | null; rir?: number | null };
  chargeUnit: string;
  onChange: (s: SessionSetLog) => void;
}

function SetEditor({ setNum, set, target, chargeUnit, onChange }: SetEditorProps) {
  const doneColor = set.done ? C.g : C.tx3;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 0",
        borderBottom: "1px solid " + C.brd,
      }}
    >
      {/* Done toggle */}
      <button
        onClick={() => {
          onChange({ ...set, done: !set.done });
          haptic();
        }}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          flexShrink: 0,
          border: "1px solid " + (set.done ? C.g + "50" : C.brdL),
          background: set.done ? C.gS : "transparent",
          color: doneColor,
          fontSize: 12,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 44,
          minHeight: 44,
        }}
      >
        {set.done ? "✓" : setNum}
      </button>

      {/* Kg */}
      {chargeUnit !== "PDC" && (
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: C.tx3, marginBottom: 1 }}>
            {chargeUnit}
            {target.kg != null && (
              <span style={{ color: VIOLET, marginLeft: 4 }}>/{target.kg}</span>
            )}
          </div>
          <input
            type="number"
            inputMode="decimal"
            value={set.kg ?? ""}
            onChange={(e) =>
              onChange({
                ...set,
                kg: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            placeholder={target.kg != null ? String(target.kg) : "—"}
            style={{
              width: "100%",
              background: C.s2,
              border: "1px solid " + C.brdL,
              borderRadius: 8,
              padding: "6px 8px",
              color: C.tx,
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        </div>
      )}

      {/* Reps */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, color: C.tx3, marginBottom: 1 }}>
          Reps
          {target.reps != null && (
            <span style={{ color: VIOLET, marginLeft: 4 }}>/{target.reps}</span>
          )}
        </div>
        <input
          type="number"
          inputMode="numeric"
          value={set.reps ?? ""}
          onChange={(e) =>
            onChange({
              ...set,
              reps:
                e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          placeholder={target.reps != null ? String(target.reps) : "—"}
          style={{
            width: "100%",
            background: C.s2,
            border: "1px solid " + C.brdL,
            borderRadius: 8,
            padding: "6px 8px",
            color: C.tx,
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
      </div>

      {/* RIR */}
      <div style={{ width: 52 }}>
        <div style={{ fontSize: 9, color: C.tx3, marginBottom: 1 }}>
          RIR
          {target.rir != null && (
            <span style={{ color: VIOLET, marginLeft: 4 }}>/{target.rir}</span>
          )}
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={5}
          value={set.rir ?? ""}
          onChange={(e) =>
            onChange({
              ...set,
              rir:
                e.target.value === ""
                  ? undefined
                  : Number(e.target.value),
            })
          }
          placeholder={target.rir != null ? String(target.rir) : "—"}
          style={{
            width: "100%",
            background: C.s2,
            border: "1px solid " + C.brdL,
            borderRadius: 8,
            padding: "6px 8px",
            color: C.tx,
            fontSize: 13,
            fontFamily: "inherit",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

// ── Timing badge ───────────────────────────────────────────────────────────────

function timingBadge(bloc: {
  timing_mode: string;
  timing_repos_min?: number;
  timing_repos_sec?: number;
  timing_depart_min?: number;
  timing_depart_sec?: number;
}): string | null {
  if (bloc.timing_mode === "libre") return null;
  if (bloc.timing_mode === "depart") {
    const min = bloc.timing_depart_min ?? 0;
    const sec = bloc.timing_depart_sec ?? 0;
    if (min > 0 && sec > 0) return `Départ /${min}min ${sec}sec`;
    if (sec > 0) return `Départ /${sec}sec`;
    return `Départ /${min}min`;
  }
  const min = bloc.timing_repos_min ?? 0;
  const sec = bloc.timing_repos_sec ?? 0;
  if (min > 0 && sec > 0) return `Repos ${min}min ${sec}sec`;
  if (min > 0) return `Repos ${min}min`;
  if (sec > 0) return `Repos ${sec}sec`;
  return null;
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { athleteId } = useAthleteContext();
  const qc = useQueryClient();

  const workout = useWorkoutSession(id);
  const saveWorkoutSets = useSaveWorkoutSets(id);

  const [showRpe, setShowRpe] = useState(false);
  const [localMods, setLocalMods] = useState<AthleteModifications>({});
  const [modsInitialized, setModsInitialized] = useState(false);

  // Initialize local mods from DB + prescription pre-fill
  useEffect(() => {
    if (workout.isLoading || modsInitialized) return;

    const base = workout.athleteModifications ?? {};
    const sessionSets: Record<string, SessionSetLog[]> = { ...(base.sessionSets ?? {}) };

    // Pre-fill sets from ExerciceParams for exercices that have no saved sets
    for (const bloc of workout.blocs) {
      for (const ex of bloc.exercices) {
        if (!sessionSets[ex.id] || sessionSets[ex.id].length === 0) {
          sessionSets[ex.id] = initSetsFromParams(ex.params);
        }
      }
    }

    setLocalMods({ ...base, sessionSets });
    setModsInitialized(true);
  }, [workout.isLoading, workout.blocs, workout.athleteModifications, modsInitialized]);

  const updateExerciceSets = useCallback((exerciceId: string, sets: SessionSetLog[]) => {
    setLocalMods((prev) => {
      const next = {
        ...prev,
        sessionSets: { ...(prev.sessionSets ?? {}), [exerciceId]: sets },
      };
      saveWorkoutSets(next);
      return next;
    });
  }, [saveWorkoutSets]);

  const updateExerciceComment = useCallback((exerciceId: string, comment: string) => {
    setLocalMods((prev) => {
      const next = {
        ...prev,
        exerciceComments: { ...(prev.exerciceComments ?? {}), [exerciceId]: comment },
      };
      saveWorkoutSets(next);
      return next;
    });
  }, [saveWorkoutSets]);

  const updateSessionComment = useCallback((comment: string) => {
    setLocalMods((prev) => {
      const next = { ...prev, sessionComment: comment };
      saveWorkoutSets(next);
      return next;
    });
  }, [saveWorkoutSets]);

  const updateForme = useCallback((forme: number) => {
    setLocalMods((prev) => {
      const next = { ...prev, sessionForme: forme };
      saveWorkoutSets(next);
      return next;
    });
  }, [saveWorkoutSets]);

  // Complete workout
  const { mutate: completeWorkout, isPending: completing } = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const { error } = await supabase
        .from("workout_logs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          athlete_modifications: localMods,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-log-detail", id] });
      qc.invalidateQueries({ queryKey: ["workout-logs-week"] });
      qc.invalidateQueries({ queryKey: ["active-plan", athleteId] });
      setShowRpe(true);
    },
  });

  const isCompleted = workout.status === "completed";
  const canEdit = !isCompleted && !!id;

  if (workout.isLoading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: C.tx3, fontSize: 13 }}>
        Chargement…
      </div>
    );
  }

  if (!workout.workoutLogId) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: C.tx3, fontSize: 13 }}>
        Séance introuvable
      </div>
    );
  }

  const FORME_LABELS = ["😴", "😐", "🙂", "💪", "🔥"];

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 140, scrollbarWidth: "none" }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid " + C.brd,
          position: "sticky",
          top: 45,
          background: C.bg,
          zIndex: 5,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            flexShrink: 0,
            border: "1px solid " + C.brdL,
            background: "transparent",
            color: C.tx3,
            fontSize: 16,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 44,
          }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: C.tx3 }}>{workout.sessionShort}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.tx }}>{workout.sessionName}</div>
          {workout.rescheduledByAthlete &&
            workout.originalScheduledDate &&
            workout.originalScheduledDate !== workout.scheduledDate && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  borderRadius: 20,
                  marginTop: 3,
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#F59E0B",
                }}
              >
                Décalée du{" "}
                {new Date(
                  workout.originalScheduledDate + "T12:00:00"
                ).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </div>
            )}
        </div>
        {isCompleted && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 20,
              background: C.gS,
              color: C.g,
            }}
          >
            ✓ Complétée
          </span>
        )}
      </div>

      {/* Blocs */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {workout.blocs.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: C.tx3, fontSize: 12 }}>
            Aucun exercice dans cette séance
          </div>
        ) : (
          workout.blocs.map((bloc, blocIdx) => {
            const timing = timingBadge(bloc);
            return (
              <div key={bloc.id}>
                {/* Bloc header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: VIOLET + "20",
                      color: VIOLET,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {String.fromCharCode(65 + blocIdx)}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>
                    {bloc.name || `Bloc ${blocIdx + 1}`}
                  </div>
                  {timing && (
                    <div
                      style={{
                        fontSize: 9,
                        color: VIOLET,
                        background: VIOLET + "15",
                        padding: "2px 7px",
                        borderRadius: 5,
                        fontWeight: 600,
                      }}
                    >
                      {timing}
                    </div>
                  )}
                </div>

                {/* Exercices */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {bloc.exercices.map((ex) => {
                    const sets =
                      localMods.sessionSets?.[ex.id] ??
                      initSetsFromParams(ex.params);
                    const comment =
                      localMods.exerciceComments?.[ex.id] ?? "";
                    const prescription = formatPrescription(ex.params);

                    return (
                      <ExerciceCard
                        key={ex.id}
                        exerciceId={ex.id}
                        name={ex.exercise_name}
                        prescription={prescription}
                        params={ex.params}
                        sets={sets}
                        comment={comment}
                        canEdit={canEdit}
                        onSetsChange={(newSets) =>
                          updateExerciceSets(ex.id, newSets)
                        }
                        onCommentChange={(c) =>
                          updateExerciceComment(ex.id, c)
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {/* Fin de séance */}
        {canEdit && (
          <div
            style={{
              background: C.s1,
              borderRadius: 14,
              border: "1px solid " + C.brd,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Forme */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.tx3,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 8,
                }}
              >
                État de forme
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {FORME_LABELS.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => updateForme(i + 1)}
                    style={{
                      flex: 1,
                      padding: "8px 4px",
                      borderRadius: 10,
                      border:
                        "1px solid " +
                        (localMods.sessionForme === i + 1 ? VIOLET : C.brdL),
                      background:
                        localMods.sessionForme === i + 1
                          ? VIOLET + "20"
                          : C.s2,
                      fontSize: 18,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      minHeight: 44,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Commentaire séance */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.tx3,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 6,
                }}
              >
                Commentaire de séance
              </div>
              <textarea
                value={localMods.sessionComment ?? ""}
                onChange={(e) => updateSessionComment(e.target.value)}
                placeholder="Comment s'est passée la séance ?"
                rows={3}
                style={{
                  width: "100%",
                  background: C.s2,
                  border: "1px solid " + C.brdL,
                  borderRadius: 10,
                  padding: "10px 12px",
                  color: C.tx,
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        )}

        {/* Show saved comment when completed */}
        {isCompleted && localMods.sessionComment && (
          <div
            style={{
              background: C.s1,
              borderRadius: 12,
              border: "1px solid " + C.brd,
              padding: "12px 16px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.tx3,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: 6,
              }}
            >
              Commentaire
            </div>
            <div style={{ fontSize: 13, color: C.tx2 }}>
              {localMods.sessionComment}
            </div>
          </div>
        )}
      </div>

      {/* Sticky "Terminer" button */}
      <div
        style={{
          position: "fixed",
          bottom: 64,
          left: 0,
          right: 0,
          zIndex: 20,
          padding: "12px 16px",
          background: "linear-gradient(transparent, " + C.bg + " 30%)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          onClick={() => {
            if (!isCompleted && !completing) {
              haptic();
              completeWorkout();
            }
          }}
          disabled={isCompleted || completing}
          style={{
            width: "100%",
            maxWidth: 480,
            padding: "16px 0",
            borderRadius: 16,
            border: "none",
            background: isCompleted ? C.s2 : C.coach,
            color: isCompleted ? C.tx3 : "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: isCompleted || completing ? "default" : "pointer",
            fontFamily: "inherit",
            minHeight: 44,
            boxShadow:
              isCompleted ? "none" : "0 4px 20px rgba(168,85,247,0.35)",
          }}
        >
          {completing
            ? "Enregistrement…"
            : isCompleted
            ? "Séance complétée ✓"
            : "Terminer la séance 🏁"}
        </button>
      </div>

      {/* RPE sheet */}
      {showRpe && workout.workoutLogId && (
        <RpeSheetForLog
          workoutLogId={workout.workoutLogId}
          onClose={() => {
            setShowRpe(false);
            navigate(-1);
          }}
        />
      )}
    </div>
  );
}

// ── Exercice card ──────────────────────────────────────────────────────────────

interface ExerciceCardProps {
  exerciceId: string;
  name: string;
  prescription: string;
  params: ExerciceParams;
  sets: SessionSetLog[];
  comment: string;
  canEdit: boolean;
  onSetsChange: (sets: SessionSetLog[]) => void;
  onCommentChange: (comment: string) => void;
}

function ExerciceCard({
  exerciceId: _exerciceId,
  name,
  prescription,
  params,
  sets,
  comment,
  canEdit,
  onSetsChange,
  onCommentChange,
}: ExerciceCardProps) {
  const [showComment, setShowComment] = useState(false);

  function updateSet(idx: number, s: SessionSetLog) {
    const next = [...sets];
    next[idx] = s;
    onSetsChange(next);
  }

  function addBonusSet() {
    onSetsChange([...sets, { done: false }]);
    haptic();
  }

  const doneSets = sets.filter((s) => s.done).length;

  return (
    <div
      style={{
        background: C.s1,
        borderRadius: 14,
        border: "1px solid " + C.brd,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "11px 14px",
          borderBottom: "1px solid " + C.brd,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.tx,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>
          <div style={{ fontSize: 10, color: VIOLET, marginTop: 2, fontWeight: 600 }}>
            {prescription}
          </div>
        </div>
        {doneSets > 0 && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.g,
              background: C.gS,
              padding: "2px 8px",
              borderRadius: 20,
              flexShrink: 0,
            }}
          >
            {doneSets}/{sets.length} ✓
          </div>
        )}
      </div>

      {/* Sets */}
      <div style={{ padding: "0 14px" }}>
        {sets.map((s, i) => (
          <SetEditor
            key={i}
            setNum={i + 1}
            set={s}
            target={getSetTarget(params, i)}
            chargeUnit={params.charge_unit}
            onChange={(newSet) => updateSet(i, newSet)}
          />
        ))}
      </div>

      {/* Comment + bonus */}
      <div style={{ padding: "4px 14px 10px" }}>
        {showComment || comment ? (
          <textarea
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Commentaire sur cet exercice…"
            rows={2}
            disabled={!canEdit}
            style={{
              width: "100%",
              background: C.s2,
              border: "1px solid " + C.brdL,
              borderRadius: 8,
              padding: "8px 10px",
              color: C.tx,
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              resize: "none",
              boxSizing: "border-box",
              marginTop: 8,
              marginBottom: canEdit ? 8 : 0,
            }}
          />
        ) : null}

        {canEdit && (
          <div style={{ display: "flex", gap: 6, marginTop: showComment || comment ? 0 : 8 }}>
            {!showComment && !comment && (
              <button
                onClick={() => setShowComment(true)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: 7,
                  border: "1px dashed " + C.brdL,
                  background: "transparent",
                  color: C.tx3,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                💬 Commentaire
              </button>
            )}
            <button
              onClick={addBonusSet}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 7,
                border: "1px dashed " + "#F59E0B50",
                background: "rgba(245,158,11,0.05)",
                color: "#F59E0B",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + Série bonus
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── RPE sheet bridged to workout_log_id ────────────────────────────────────────

function RpeSheetForLog({
  workoutLogId,
  onClose,
}: {
  workoutLogId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { athleteId } = useAthleteContext();
  const [rpe, setRpe] = useState<number | null>(null);

  const { mutate: saveRpe, isPending } = useMutation({
    mutationFn: async (rpeScore: number) => {
      await supabase
        .from("workout_logs")
        .update({ rpe_score: rpeScore })
        .eq("id", workoutLogId);
      await supabase.from("workout_rpe").upsert({
        workout_log_id: workoutLogId,
        athlete_id: athleteId ?? "",
        rpe_score: rpeScore,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-log-detail", workoutLogId] });
      onClose();
    },
  });

  const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: C.bg,
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px 40px",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: C.tx,
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          🏁 Séance terminée !
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.tx3,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Quelle était ton effort global ? (RPE)
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          {RPE_VALUES.map((v) => (
            <button
              key={v}
              onClick={() => setRpe(v)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                border:
                  "1px solid " + (rpe === v ? VIOLET : C.brdL),
                background: rpe === v ? VIOLET + "20" : C.s1,
                color: rpe === v ? VIOLET : C.tx,
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: "1px solid " + C.brdL,
              background: "transparent",
              color: C.tx2,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Passer
          </button>
          <button
            onClick={() => rpe != null && saveRpe(rpe)}
            disabled={rpe == null || isPending}
            style={{
              flex: 2,
              padding: "12px 0",
              borderRadius: 12,
              border: "none",
              background: rpe != null ? VIOLET : C.s2,
              color: rpe != null ? "#fff" : C.tx3,
              fontSize: 13,
              fontWeight: 700,
              cursor: rpe != null ? "pointer" : "default",
              fontFamily: "inherit",
            }}
          >
            {isPending ? "Enregistrement…" : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
