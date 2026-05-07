import { useState } from "react";
import { isToday, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, X, ChevronDown, ChevronUp, Hourglass } from "lucide-react";
import { C } from "@/lib/theme";
import { DayDetailPanel } from "./DayDetailPanel";
import type { WeeklyRetourData, WellnessDay, FreeActivityDetail } from "@/features/shared/types/retours.types";

type DayWorkout    = WeeklyRetourData["workouts"][number];
type DayEnergy     = WeeklyRetourData["energy_sessions"][number];

interface DayColumnProps {
  date:              string;               // "yyyy-MM-dd"
  workouts:          DayWorkout[];
  energy:            DayEnergy[];
  wellness:          WellnessDay | null;
  previousWorkouts?: DayWorkout[];
  freeActivities?:   FreeActivityDetail[];
}

// ── Status icon ───────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <Check size={10} color={C.g} />;
  if (status === "partial")   return <Check size={10} color={C.tx3} />;
  if (status === "planned" || status === "in-progress") return <Hourglass size={10} color={C.tx3} />;
  return <X size={10} color={C.tx3} />;
}

// ── Wellness mini-block ───────────────────────────────────────────────────────

function wellnessColor(score: number) {
  if (score >= 70) return C.g;
  if (score >= 50) return C.o;
  return C.r;
}

function WellnessBlock({
  wellness, onClick,
}: { wellness: WellnessDay; onClick: () => void }) {
  const col = wellnessColor(wellness.score);
  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        background: col + "12",
        border: "1px solid " + col + "40",
        borderRadius: 8,
        padding: "7px 8px",
      }}
    >
      {/* Score */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 5 }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: col, lineHeight: 1 }}>{wellness.score}</span>
        <span style={{ fontSize: 9, color: C.tx3 }}>/100</span>
        <span style={{ marginLeft: "auto", fontSize: 9, color: C.tx3 }}>↗</span>
      </div>

      {/* Sub-scores */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {[
          { label: "💤", value: wellness.sommeil },
          { label: "😴", value: wellness.fatigue },
          { label: "😰", value: wellness.stress  },
          { label: "⚡", value: wellness.energie },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9 }}>{label}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: C.tx2 }}>{value ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Workout compact row ───────────────────────────────────────────────────────

function WorkoutRow({ workout, prevWorkout }: {
  workout:      DayWorkout;
  prevWorkout?: DayWorkout | null;
}) {
  const [open, setOpen] = useState(false);
  const done = workout.status === "completed";

  if (!done) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        background: C.s2, borderRadius: 7, padding: "5px 7px",
        opacity: 0.5,
      }}>
        <StatusIcon status={workout.status} />
        <span style={{
          flex: 1, fontSize: 10, fontWeight: 600, color: C.tx2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {workout.session_name}
        </span>
        <span style={{ fontSize: 8, color: C.tx3, flexShrink: 0 }}>
          {workout.status === "planned" || workout.status === "in-progress" ? "planifié" : "manquée"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ background: C.s2, borderRadius: 7, overflow: "hidden" }}>
      {/* Summary row */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 7px", cursor: "pointer" }}
      >
        <StatusIcon status={workout.status} />
        <span style={{
          flex: 1, fontSize: 10, fontWeight: 600, color: C.tx,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {workout.session_name}
        </span>
        {workout.rpe_score != null && (
          <span style={{ fontSize: 8, color: C.tx3, flexShrink: 0 }}>RPE {workout.rpe_score}</span>
        )}
        {open ? <ChevronUp size={9} color={C.tx3} /> : <ChevronDown size={9} color={C.tx3} />}
      </div>

      {/* Expanded: planned + actual exercises */}
      {open && (() => {
        const exIds = [...new Set([
          ...workout.planned_exercises.map((p) => p.exercise_id),
          ...workout.performed_exercises.map((p) => p.exercise_id),
        ])];
        return (
          <div style={{ borderTop: "1px solid " + C.brd, padding: "6px 7px", display: "flex", flexDirection: "column", gap: 5 }}>
            {workout.duration_s != null && (
              <div style={{ fontSize: 9, color: C.tx3 }}>{Math.round(workout.duration_s / 60)} min</div>
            )}
            {workout.notes && (
              <div style={{ fontSize: 9, color: C.tx3, fontStyle: "italic" }}>{workout.notes}</div>
            )}
            {exIds.length > 0 ? exIds.map((exId) => {
              const planned   = workout.planned_exercises.find((p) => p.exercise_id === exId);
              const performed = workout.performed_exercises.find((p) => p.exercise_id === exId);
              const prevEx    = prevWorkout?.performed_exercises.find((p) => p.exercise_id === exId);
              const name      = planned?.exercise_name ?? performed?.exercise_name ?? "Exercice";
              const comment   = workout.exercise_comments.find((c) => c.exercise_id === exId || c.exercise_name === name);
              return (
                <div key={exId} style={{ fontSize: 9 }}>
                  <div style={{ fontWeight: 700, color: C.tx, marginBottom: 2 }}>{name}</div>
                  {/* Planned target */}
                  {planned && planned.sets > 0 && (
                    <div style={{ fontSize: 8, color: C.tx3, paddingLeft: 6, marginBottom: 2 }}>
                      ↗ {planned.sets}×{planned.reps_range ?? "—"}
                      {planned.kg != null ? ` @${planned.kg}kg` : ""}
                      {planned.rir != null ? ` RIR${planned.rir}` : ""}
                    </div>
                  )}
                  {/* Actual sets */}
                  {performed?.sets.map((s) => (
                    <div key={s.set_num} style={{ display: "flex", gap: 4, color: C.tx2, paddingLeft: 6 }}>
                      <span style={{ color: C.tx3, minWidth: 14 }}>S{s.set_num}</span>
                      <span style={{ fontWeight: 600 }}>
                        {s.kg != null ? `${s.kg}kg` : "—"} × {s.reps ?? "—"}
                      </span>
                      {s.rir != null && <span style={{ color: C.tx3 }}>RIR{s.rir}</span>}
                    </div>
                  ))}
                  {!performed && (
                    <div style={{ fontSize: 8, color: C.tx3, paddingLeft: 6, fontStyle: "italic" }}>Non enregistré</div>
                  )}
                  {/* S-1 comparison */}
                  {prevEx && prevEx.sets.length > 0 && (
                    <div style={{ marginTop: 2, paddingLeft: 6, color: C.tx3, fontStyle: "italic" }}>
                      S-1 : {prevEx.sets[0].kg ?? "—"}kg × {prevEx.sets[0].reps ?? "—"}
                    </div>
                  )}
                  {/* Comment */}
                  {comment && (
                    <div style={{ marginTop: 3, padding: "2px 5px", borderRadius: 4, background: C.acS, color: C.ac, fontSize: 8 }}>
                      {comment.comment}
                    </div>
                  )}
                </div>
              );
            }) : (
              <span style={{ fontSize: 9, color: C.tx3, fontStyle: "italic" }}>Aucun résultat enregistré</span>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── Energy compact row ────────────────────────────────────────────────────────

function EnergyRow({ session }: { session: DayEnergy }) {
  const [open, setOpen] = useState(false);
  const done     = session.completed || session.partial;
  const blEntries = session.block_logs ? Object.entries(session.block_logs) : [];
  const doneCount  = blEntries.filter(([, b]) => b.done).length;
  const totalCount = blEntries.length;
  const hasDetail  = done && (blEntries.length > 0 || !!session.note || session.rpe_score != null);

  const status = session.completed ? "completed" : session.partial ? "partial" : "planned";

  if (!done) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        background: C.s2, borderRadius: 7, padding: "5px 7px", opacity: 0.5,
      }}>
        <StatusIcon status="planned" />
        <span style={{
          flex: 1, fontSize: 10, fontWeight: 600, color: C.tx2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {session.session_label}
        </span>
        <span style={{ fontSize: 8, color: C.tx3, flexShrink: 0 }}>planifié</span>
      </div>
    );
  }

  return (
    <div style={{ background: C.s2, borderRadius: 7, overflow: "hidden" }}>
      <div
        onClick={() => hasDetail && setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 7px", cursor: hasDetail ? "pointer" : "default" }}
      >
        <StatusIcon status={status} />
        <span style={{
          flex: 1, fontSize: 10, fontWeight: 600, color: C.tx,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {session.session_label}
        </span>
        {session.partial && totalCount > 0 && (
          <span style={{ fontSize: 8, color: C.tx3, flexShrink: 0 }}>{doneCount}/{totalCount}</span>
        )}
        {session.rpe_score != null && (
          <span style={{ fontSize: 8, color: C.tx3, flexShrink: 0 }}>RPE {session.rpe_score}</span>
        )}
        {hasDetail && (open ? <ChevronUp size={9} color={C.tx3} /> : <ChevronDown size={9} color={C.tx3} />)}
      </div>

      {open && (
        <div style={{ borderTop: "1px solid " + C.brd, padding: "5px 7px", display: "flex", flexDirection: "column", gap: 3 }}>
          {session.duration_min != null && (
            <div style={{ fontSize: 9, color: C.tx3 }}>{session.duration_min} min</div>
          )}
          {blEntries.map(([key, b], i) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9 }}>
              <span style={{
                width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
                background: b.done ? C.g : "transparent",
                border: "1px solid " + (b.done ? C.g : C.tx3),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 7, color: "#fff",
              }}>
                {b.done ? "✓" : ""}
              </span>
              <span style={{ color: b.done ? C.tx : C.tx3 }}>Bloc {i + 1}</span>
              {b.note && <span style={{ color: C.tx3, fontStyle: "italic" }}>{b.note}</span>}
            </div>
          ))}
          {session.note && (
            <div style={{ fontSize: 8, color: C.tx3, fontStyle: "italic", paddingLeft: 2 }}>{session.note}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Free activity compact row ─────────────────────────────────────────────────

function FreeActivityRow({ activity }: { activity: FreeActivityDetail }) {
  const [open, setOpen] = useState(false);
  const hasDetail = activity.duration != null || activity.intensity != null || !!activity.note;

  return (
    <div style={{ background: C.s2, borderRadius: 7, overflow: "hidden" }}>
      <div
        onClick={() => hasDetail && setOpen((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 7px", cursor: hasDetail ? "pointer" : "default" }}
      >
        <Check size={10} color={C.g} />
        <span style={{
          flex: 1, fontSize: 10, fontWeight: 600, color: C.tx,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {activity.sportEmoji ? activity.sportEmoji + " " : ""}{activity.name}
        </span>
        {activity.intensity != null && (
          <span style={{ fontSize: 8, color: C.tx3, flexShrink: 0 }}>RPE {activity.intensity}</span>
        )}
        {hasDetail && (open ? <ChevronUp size={9} color={C.tx3} /> : <ChevronDown size={9} color={C.tx3} />)}
      </div>

      {open && (
        <div style={{ borderTop: "1px solid " + C.brd, padding: "5px 7px", display: "flex", flexDirection: "column", gap: 3 }}>
          {activity.duration != null && (
            <div style={{ fontSize: 9, color: C.tx2 }}>{activity.duration} min</div>
          )}
          {activity.intensity != null && (
            <div style={{ fontSize: 9, color: C.tx2 }}>RPE {activity.intensity}/10</div>
          )}
          {activity.note && (
            <div style={{ fontSize: 8, color: C.tx3, fontStyle: "italic" }}>{activity.note}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function DayColumn({ date, workouts, energy, wellness, previousWorkouts, freeActivities = [] }: DayColumnProps) {
  const today    = isToday(parseISO(date));
  const dayLabel = format(parseISO(date), "EEE", { locale: fr });
  const dayNum   = format(parseISO(date), "d");
  const [showWellness, setShowWellness] = useState(false);

  return (
    <>
      <div style={{
        minWidth: 120,
        background: C.s1,
        border: today ? "2px solid " + C.ac + "60" : "1px solid " + C.brd,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "8px 8px 6px",
          background: today ? C.ac + "08" : "transparent",
          borderBottom: "1px solid " + C.brd,
          textAlign: "center",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: today ? C.ac : C.tx3,
            textTransform: "capitalize", marginBottom: 1,
          }}>
            {dayLabel}
          </div>
          <div style={{
            fontSize: 20, fontWeight: 900, lineHeight: 1,
            color: today ? C.ac : C.tx,
          }}>
            {dayNum}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "8px 6px", display: "flex", flexDirection: "column", gap: 6 }}>

          {/* Wellness — always first */}
          {wellness ? (
            <WellnessBlock wellness={wellness} onClick={() => setShowWellness(true)} />
          ) : (
            <div style={{ textAlign: "center", padding: "5px 0" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.brd, margin: "0 auto 3px" }} />
              <span style={{ fontSize: 8, color: C.tx3 }}>—</span>
            </div>
          )}

          {/* Muscu workouts */}
          {workouts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {workouts.map((w) => (
                <WorkoutRow
                  key={w.id}
                  workout={w}
                  prevWorkout={previousWorkouts?.find((pw) => pw.session_name === w.session_name) ?? null}
                />
              ))}
            </div>
          )}

          {/* Energy sessions */}
          {energy.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {energy.map((e) => (
                <EnergyRow key={e.id} session={e} />
              ))}
            </div>
          )}

          {/* Free activities */}
          {freeActivities.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {freeActivities.map((f) => (
                <FreeActivityRow key={f.id} activity={f} />
              ))}
            </div>
          )}

          {/* Rest day */}
          {workouts.length === 0 && energy.length === 0 && freeActivities.length === 0 && !wellness && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, color: C.tx3 }}>Repos</span>
            </div>
          )}
        </div>
      </div>

      {/* Wellness detail overlay */}
      {showWellness && wellness && (
        <DayDetailPanel
          date={date}
          wellness={wellness}
          onClose={() => setShowWellness(false)}
        />
      )}
    </>
  );
}
