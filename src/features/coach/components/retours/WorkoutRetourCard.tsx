import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronDown, ChevronUp, MessageSquare, Heart } from "lucide-react";
import { C } from "@/lib/theme";
import { StatusPill } from "@/features/shared/components/StatusPill";
import { useUpsertExerciseComment } from "@/features/shared/hooks/retoursComments.mutations";
import type { SessionStatus } from "@/features/shared/components/StatusPill";
import type {
  PerformedExercise,
  PlannedExercise,
  PerformedSet,
  WorkoutExerciseComment,
} from "@/features/shared/types/retours.types";

interface WorkoutType {
  id: string;
  session_name: string;
  scheduled_date: string;
  status: string;
  duration_s: number | null;
  notes: string | null;
  rpe_score: number | null;
  wellness_day: number | null;
  exercise_comments: WorkoutExerciseComment[];
  planned_exercises: PlannedExercise[];
  performed_exercises: PerformedExercise[];
}

interface WorkoutRetourCardProps {
  workout: WorkoutType;
  previousWeekWorkout?: WorkoutType | null;
}

const VALID_STATUSES = ["planned", "in-progress", "completed", "missed", "skipped"];

function formatPlanned(ex: PlannedExercise): string {
  const parts: string[] = [];
  parts.push(`${ex.sets} × ${ex.reps_range ?? "—"}`);
  if (ex.kg) parts.push(`@ ${ex.kg}kg`);
  if (ex.rir != null) parts.push(`RIR ${ex.rir}`);
  if (ex.method) parts.push(ex.method);
  return parts.join(" · ");
}

function SetTable({ sets }: { sets: PerformedSet[] }) {
  if (sets.length === 0) return <span style={{ fontSize: 11, color: C.tx3 }}>—</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {sets.map((s) => (
        <div key={s.set_num} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <span style={{ color: C.tx3, minWidth: 16 }}>S{s.set_num}</span>
          <span style={{ color: C.tx, fontWeight: 600 }}>
            {s.kg != null ? `${s.kg}kg` : "—"}
            {" × "}
            {s.reps != null ? `${s.reps}` : "—"}
          </span>
          {s.rir != null && (
            <span style={{ color: C.tx3, fontSize: 10 }}>RIR {s.rir}</span>
          )}
          {s.method && (
            <span style={{ color: C.tx3, fontSize: 10, fontStyle: "italic" }}>{s.method}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function PrevSetSummary({ performed }: { performed: PerformedExercise }) {
  const sets = performed.sets;
  if (!sets.length) return <span style={{ fontSize: 11, color: C.tx3 }}>—</span>;
  // Summarize: avg kg × avg reps across sets
  const kgs = sets.map((s) => s.kg).filter((v): v is number => v != null);
  const reps = sets.map((s) => s.reps).filter((v): v is number => v != null);
  const avgKg = kgs.length ? Math.round(kgs.reduce((a, b) => a + b, 0) / kgs.length) : null;
  const avgReps = reps.length ? Math.round(reps.reduce((a, b) => a + b, 0) / reps.length) : null;
  return (
    <span style={{ fontSize: 11, color: C.tx2 }}>
      {sets.length} × {avgReps ?? "—"}{avgKg != null ? ` @ ${avgKg}kg` : ""}
    </span>
  );
}

export function WorkoutRetourCard({ workout, previousWeekWorkout }: WorkoutRetourCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [commentingEx, setCommentingEx] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [showPrev, setShowPrev] = useState(false);

  const upsertComment = useUpsertExerciseComment();

  const handleSaveComment = (exerciseName: string, exerciseId: string | null) => {
    if (!commentText.trim()) return;
    upsertComment.mutate(
      { workoutLogId: workout.id, exerciseId, exerciseName, comment: commentText },
      { onSuccess: () => { setCommentingEx(null); setCommentText(""); } }
    );
  };

  const validStatus = VALID_STATUSES.includes(workout.status) ? (workout.status as SessionStatus) : "planned";

  // Build unified exercise list: planned first, then performed-only
  const allExerciseIds = new Set<string>();
  const plannedMap = new Map<string, PlannedExercise>();
  const performedMap = new Map<string, PerformedExercise>();

  for (const ex of workout.planned_exercises) {
    plannedMap.set(ex.exercise_id, ex);
    allExerciseIds.add(ex.exercise_id);
  }
  for (const ex of workout.performed_exercises) {
    performedMap.set(ex.exercise_id, ex);
    allExerciseIds.add(ex.exercise_id);
  }

  // Previous week performed map
  const prevPerformedMap = new Map<string, PerformedExercise>();
  if (previousWeekWorkout) {
    for (const ex of previousWeekWorkout.performed_exercises) {
      prevPerformedMap.set(ex.exercise_id, ex);
    }
  }

  return (
    <div style={{ background: C.s1, border: "1px solid " + C.brd, borderRadius: 12, overflow: "hidden" }}>
      {/* Header */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {workout.session_name}
          </span>
          <StatusPill status={validStatus} size="sm" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
          {workout.wellness_day != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Heart size={10} color={C.tx3} />
              <span style={{ fontSize: 10, color: C.tx3 }}>{workout.wellness_day}/10</span>
            </div>
          )}
          {workout.rpe_score != null && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 6, background: C.s2, color: C.tx2, flexShrink: 0 }}>
              RPE {workout.rpe_score}/10
            </span>
          )}
          <span style={{ fontSize: 10, color: C.tx3 }}>
            {format(new Date(workout.scheduled_date), "EEE d MMM", { locale: fr })}
          </span>
          {expanded ? <ChevronUp size={13} color={C.tx3} /> : <ChevronDown size={13} color={C.tx3} />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid " + C.brd, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Meta row */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {workout.duration_s != null && (
              <div style={{ fontSize: 11, color: C.tx2 }}>
                Durée : <span style={{ fontWeight: 600, color: C.tx }}>{Math.round(workout.duration_s / 60)} min</span>
              </div>
            )}
            {workout.wellness_day != null && (
              <div style={{ fontSize: 11, color: C.tx2 }}>
                Forme jour : <span style={{ fontWeight: 600, color: C.tx }}>{workout.wellness_day}/10</span>
              </div>
            )}
            {workout.rpe_score != null && (
              <div style={{ fontSize: 11, color: C.tx2 }}>
                RPE : <span style={{ fontWeight: 600, color: C.tx }}>{workout.rpe_score}/10</span>
              </div>
            )}
          </div>

          {workout.notes && (
            <div style={{ background: C.s2, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 3 }}>Note de séance</div>
              <div style={{ fontSize: 12, color: C.tx2 }}>{workout.notes}</div>
            </div>
          )}

          {/* Exercises */}
          {allExerciseIds.size > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>Exercices</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...allExerciseIds].map((exId) => {
                  const planned = plannedMap.get(exId);
                  const performed = performedMap.get(exId);
                  const prevPerformed = prevPerformedMap.get(exId);
                  const exName = planned?.exercise_name ?? performed?.exercise_name ?? exId;
                  const existingComment = workout.exercise_comments.find(
                    (c) => c.exercise_id === exId || c.exercise_name === exName
                  );

                  return (
                    <div key={exId} style={{ background: C.s2, borderRadius: 8, padding: "8px 10px" }}>
                      {/* Exercise header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.tx }}>{exName}</span>
                        <button
                          onClick={() => {
                            if (commentingEx === exId) { setCommentingEx(null); setCommentText(""); }
                            else { setCommentingEx(exId); setCommentText(existingComment?.comment ?? ""); }
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: "1px solid " + C.brdL, background: existingComment ? C.acS : "transparent", color: existingComment ? C.ac : C.tx3, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          <MessageSquare size={10} />
                          {existingComment ? "Modifier" : "Commenter"}
                        </button>
                      </div>

                      {/* Planned / Réalisé / S-1 grid */}
                      <div style={{ display: "grid", gridTemplateColumns: previousWeekWorkout ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 9, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4 }}>Planifié</div>
                          {planned ? (
                            <div style={{ fontSize: 11, color: C.tx2 }}>{formatPlanned(planned)}</div>
                          ) : (
                            <span style={{ fontSize: 11, color: C.tx3 }}>—</span>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4 }}>Réalisé</div>
                          {performed ? <SetTable sets={performed.sets} /> : <span style={{ fontSize: 11, color: C.tx3 }}>—</span>}
                        </div>
                        {previousWeekWorkout && (
                          <div>
                            <div style={{ fontSize: 9, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4 }}>S-1</div>
                            {prevPerformed ? <PrevSetSummary performed={prevPerformed} /> : <span style={{ fontSize: 11, color: C.tx3 }}>—</span>}
                          </div>
                        )}
                      </div>

                      {/* Existing comment */}
                      {existingComment && commentingEx !== exId && (
                        <div style={{ marginTop: 6, background: C.acS, borderRadius: 6, padding: "5px 8px" }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: C.ac, marginBottom: 2 }}>Commentaire</div>
                          <div style={{ fontSize: 11, color: C.tx2 }}>{existingComment.comment}</div>
                        </div>
                      )}

                      {/* Comment form */}
                      {commentingEx === exId && (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                          <textarea
                            autoFocus
                            placeholder="Ajouter un commentaire…"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            rows={2}
                            style={{ width: "100%", background: C.s1, border: "1px solid " + C.brdL, borderRadius: 8, padding: "7px 10px", color: C.tx, fontSize: 12, fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box" }}
                          />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => handleSaveComment(exName, exId)}
                              disabled={!commentText.trim() || upsertComment.isPending}
                              style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: C.coach, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                            >
                              Enregistrer
                            </button>
                            <button
                              onClick={() => { setCommentingEx(null); setCommentText(""); }}
                              style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* S-1 global summary (if no shared exercises) */}
          {previousWeekWorkout && allExerciseIds.size === 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>S-1</div>
              <div style={{ background: C.s2, borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <StatusPill status={VALID_STATUSES.includes(previousWeekWorkout.status) ? previousWeekWorkout.status as SessionStatus : "planned"} size="sm" />
                {previousWeekWorkout.rpe_score != null && (
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: C.s1, color: C.tx2 }}>RPE {previousWeekWorkout.rpe_score}/10</span>
                )}
                {previousWeekWorkout.notes && <span style={{ fontSize: 11, color: C.tx3 }}>{previousWeekWorkout.notes}</span>}
              </div>
            </div>
          )}

          {/* S-1 toggle when exercises shown */}
          {previousWeekWorkout && allExerciseIds.size > 0 && (
            <div>
              <button
                onClick={() => setShowPrev((v) => !v)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: C.tx3, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.4px", padding: 0 }}
              >
                {showPrev ? <ChevronUp size={10} /> : <ChevronDown size={10} />} Détails S-1
              </button>
              {showPrev && (
                <div style={{ marginTop: 6, background: C.s2, borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: previousWeekWorkout.notes ? 6 : 0 }}>
                    <StatusPill status={VALID_STATUSES.includes(previousWeekWorkout.status) ? previousWeekWorkout.status as SessionStatus : "planned"} size="sm" />
                    {previousWeekWorkout.wellness_day != null && (
                      <span style={{ fontSize: 10, color: C.tx3 }}>Forme {previousWeekWorkout.wellness_day}/10</span>
                    )}
                    {previousWeekWorkout.rpe_score != null && (
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: C.s1, color: C.tx2 }}>RPE {previousWeekWorkout.rpe_score}/10</span>
                    )}
                    {previousWeekWorkout.duration_s != null && (
                      <span style={{ fontSize: 10, color: C.tx3 }}>{Math.round(previousWeekWorkout.duration_s / 60)} min</span>
                    )}
                  </div>
                  {previousWeekWorkout.notes && (
                    <div style={{ fontSize: 11, color: C.tx3, fontStyle: "italic" }}>{previousWeekWorkout.notes}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
