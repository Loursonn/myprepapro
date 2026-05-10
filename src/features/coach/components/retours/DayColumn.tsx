import { useState } from "react";
import { isToday, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Zap, Check, X, ChevronDown, ChevronUp, Hourglass } from "lucide-react";
import { C } from "@/lib/theme";
import { DayDetailPanel } from "./DayDetailPanel";
import { ROLE_COLOR, ROLE_LABEL_FR } from "@/features/coach/components/energy/SessionPreviewModal";
import { formatS, formatTarget } from "@/lib/energy/formatTarget";
import type { WeeklyRetourData, WellnessDay, EnergyStepLog, FreeActivityDetail } from "@/features/shared/types/retours.types";

type DayWorkout = WeeklyRetourData["workouts"][number];
type DayEnergy  = WeeklyRetourData["energy_sessions"][number];
type DayTest    = WeeklyRetourData["test_sessions"][number];

const TEST_TYPE_COLOR: Record<string, string> = {
  musculation: "#7B6FFF", endurance: "#3B8DF0", vitesse: "#EF4444",
  puissance: "#F59E0B", souplesse: "#10B981", autre: "#6B7280",
};

interface DayColumnProps {
  date:                   string;               // "yyyy-MM-dd"
  workouts:               DayWorkout[];
  energy:                 DayEnergy[];
  tests:                  DayTest[];
  wellness:               WellnessDay | null;
  previousWorkouts?:      DayWorkout[];
  rescheduledWorkoutIds?: Set<string>;
  rescheduledEnergyIds?:  Set<string>;
  freeActivities?:        FreeActivityDetail[];
}

// ── Status color helper ───────────────────────────────────────────────────────

function statusColors(status: string, rescheduled = false) {
  if (rescheduled)            return { bg: "#8B5CF612", border: "#8B5CF630", accent: "#8B5CF6", label: "Déplacée" };
  if (status === "completed") return { bg: C.g + "12", border: C.g + "40",  accent: C.g,       label: "✓ Faite" };
  if (status === "missed")    return { bg: C.r + "12", border: C.r + "40",  accent: C.r,       label: "Manquée" };
  if (status === "skipped")   return { bg: C.s2,       border: C.brd,       accent: C.tx3,     label: "Skippée" };
  return                             { bg: C.s2,       border: C.brd,       accent: C.tx3,     label: "Planifiée" };
}

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

function WellnessBlock({ wellness, onClick }: { wellness: WellnessDay; onClick: () => void }) {
  const col = wellnessColor(wellness.score);
  return (
    <div onClick={onClick} style={{ cursor: "pointer", background: col + "12", border: "1px solid " + col + "40", borderRadius: 8, padding: "7px 8px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 5 }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: col, lineHeight: 1 }}>{wellness.score}</span>
        <span style={{ fontSize: 9, color: C.tx3 }}>/100</span>
        <span style={{ marginLeft: "auto", fontSize: 9, color: C.tx3 }}>↗</span>
      </div>
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

// ── Workout row ───────────────────────────────────────────────────────────────

function WorkoutRow({ workout, prevWorkout, isRescheduled }: { workout: DayWorkout; prevWorkout?: DayWorkout | null; isRescheduled?: boolean }) {
  const [open, setOpen] = useState(false);
  const done = workout.status === "completed";
  const cols = statusColors(workout.status, isRescheduled);

  return (
    <div style={{ background: cols.bg, border: "1px solid " + cols.border, borderRadius: 7, overflow: "hidden" }}>
      {/* Header */}
      <div
        onClick={done ? () => setOpen(v => !v) : undefined}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 7px", cursor: done ? "pointer" : "default" }}
      >
        <span style={{ fontSize: 9, color: cols.accent, flexShrink: 0 }}>
          {workout.status === "completed" ? "✓" : workout.status === "missed" ? "✗" : "–"}
        </span>
        <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: done ? C.tx : C.tx3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {workout.session_name}
        </span>
        {done && workout.rpe_score != null && (
          <span style={{ fontSize: 8, color: C.tx3, flexShrink: 0 }}>RPE {workout.rpe_score}</span>
        )}
        {!done && (
          <span style={{ fontSize: 8, color: cols.accent, flexShrink: 0 }}>{cols.label}</span>
        )}
        {done && (open ? <ChevronUp size={9} color={C.tx3} /> : <ChevronDown size={9} color={C.tx3} />)}
      </div>

      {/* Expanded: planned + actual exercises */}
      {done && open && (() => {
        const exIds = [...new Set([
          ...workout.planned_exercises.map((p) => p.exercise_id),
          ...workout.performed_exercises.map((p) => p.exercise_id),
        ])];
        return (
          <div style={{ borderTop: "1px solid " + C.g + "30", padding: "6px 7px", display: "flex", flexDirection: "column", gap: 5 }}>
            {workout.duration_s != null && (
              <div style={{ fontSize: 9, color: C.tx3 }}>{Math.round(workout.duration_s / 60)} min</div>
            )}
            {workout.notes && (
              <div style={{ fontSize: 9, color: C.tx3, fontStyle: "italic" }}>« {workout.notes} »</div>
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
                      <span style={{ fontWeight: 600 }}>{s.kg != null ? `${s.kg}kg` : "—"} × {s.reps ?? "—"}</span>
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

// ── Energy step row (compact) ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EnergyStepRow({ step, log, index }: { step: any; log: Record<string, EnergyStepLog> | null; index: number }) {
  const id    = step.id ?? String(index);
  const entry = log?.[id];

  if (step.type === "interval") {
    const rc  = ROLE_COLOR[step.role as string] ?? "#6B7280";
    const dur = step.duration?.kind === "time"     ? formatS(step.duration.value ?? 0)
              : step.duration?.kind === "distance" ? `${step.duration.value ?? 0} m`
              : "Lap";
    const tgt = step.target ? formatTarget(step.target) : null;

    return (
      <div style={{ padding: "3px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 2, height: 20, borderRadius: 1, background: rc, flexShrink: 0 }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: rc }}>{ROLE_LABEL_FR[step.role as string] ?? step.role}</span>
          <span style={{ fontSize: 9, color: C.tx }}>{dur}</span>
          {tgt && tgt !== "Libre" && <span style={{ fontSize: 8, color: C.tx3 }}>{tgt}</span>}
          <div style={{ marginLeft: "auto", flexShrink: 0 }}>
            {entry?.status === "done"    && <span style={{ fontSize: 8, fontWeight: 700, color: C.g }}>✓</span>}
            {entry?.status === "partial" && <span style={{ fontSize: 8, fontWeight: 700, color: "#F59E0B" }}>~</span>}
            {!entry && log !== null      && <span style={{ fontSize: 8, color: C.tx3 }}>—</span>}
          </div>
        </div>
        {entry?.status === "partial" && entry.comment && (
          <div style={{ fontSize: 8, color: "#F59E0B", fontStyle: "italic", marginTop: 2, paddingLeft: 8 }}>
            {entry.comment}
          </div>
        )}
      </div>
    );
  }

  // Group
  return (
    <div style={{ padding: "3px 4px", background: "rgba(59,141,240,0.06)", borderRadius: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: C.b }}>× {step.repeat}</span>
        <span style={{ fontSize: 8, color: C.tx3 }}>{(step.children as unknown[])?.length ?? 0} étapes</span>
        <div style={{ marginLeft: "auto" }}>
          {entry?.status === "done"    && <span style={{ fontSize: 8, fontWeight: 700, color: C.g }}>✓</span>}
          {entry?.status === "partial" && <span style={{ fontSize: 8, fontWeight: 700, color: "#F59E0B" }}>~</span>}
        </div>
      </div>
      {entry?.status === "partial" && entry.comment && (
        <div style={{ fontSize: 8, color: "#F59E0B", fontStyle: "italic", marginTop: 2 }}>
          {entry.comment}
        </div>
      )}
    </div>
  );
}

// ── Energy row ────────────────────────────────────────────────────────────────

function EnergyRow({ session, isRescheduled }: { session: DayEnergy; isRescheduled?: boolean }) {
  const [open, setOpen] = useState(false);
  const done     = session.status === "completed";
  const cols     = statusColors(session.status, isRescheduled);
  const hasSteps = (session as { intervals?: unknown[] }).intervals?.length ?? 0 > 0;

  const kindColors: Record<string, string> = {
    vo2: "#A855F7", tempo: "#3B8DF0", seuil: "#F59E0B",
    footing: "#10B981", fartlek: "#EF4444",
  };
  const kindColor = kindColors[session.session_kind ?? ""] ?? "#6B7280";

  return (
    <div style={{ background: cols.bg, border: "1px solid " + cols.border, borderRadius: 7, overflow: "hidden" }}>
      {/* Header */}
      <div
        onClick={done ? () => setOpen(v => !v) : undefined}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 7px", cursor: done ? "pointer" : "default" }}
      >
        <Zap size={9} color={done ? kindColor : cols.accent} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: done ? C.tx : C.tx3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {session.session_label}
        </span>
        {session.session_kind && done && (
          <span style={{ fontSize: 8, color: kindColor, flexShrink: 0, fontWeight: 700 }}>
            {session.session_kind.toUpperCase()}
          </span>
        )}
        {!done && <span style={{ fontSize: 8, color: cols.accent, flexShrink: 0 }}>{cols.label}</span>}
        {done && (open ? <ChevronUp size={9} color={C.tx3} /> : <ChevronDown size={9} color={C.tx3} />)}
      </div>

      {/* Expanded: step log */}
      {done && open && (
        <div style={{ borderTop: "1px solid " + C.g + "30", padding: "6px 7px", display: "flex", flexDirection: "column", gap: 2 }}>
          {session.duration_min != null && (
            <div style={{ fontSize: 9, color: C.tx3, marginBottom: 2 }}>{session.duration_min} min</div>
          )}
          {session.note && (
            <div style={{ fontSize: 9, color: C.tx3, fontStyle: "italic", marginBottom: 2 }}>« {session.note} »</div>
          )}
          {/* Block logs (new system) */}
          {session.block_logs && Object.entries(session.block_logs).length > 0 ? (
            Object.entries(session.block_logs).map(([key, b], i) => (
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
                {(b as { note?: string }).note && <span style={{ color: C.tx3, fontStyle: "italic" }}>{(b as { note?: string }).note}</span>}
              </div>
            ))
          ) : hasSteps ? (
            ((session as { intervals?: unknown[] }).intervals ?? []).map((step, i) => (
              <EnergyStepRow
                key={(step as { id?: string }).id ?? i}
                step={step}
                log={(session as { step_log?: Record<string, EnergyStepLog> | null }).step_log ?? null}
                index={i}
              />
            ))
          ) : (
            <span style={{ fontSize: 9, color: C.tx3, fontStyle: "italic" }}>Aucun détail disponible</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Test row ──────────────────────────────────────────────────────────────────

function TestRow({ test }: { test: DayTest }) {
  const [open, setOpen] = useState(false);
  const tc = TEST_TYPE_COLOR[test.type] ?? "#6B7280";
  const done = test.completed;

  // Parse structured results if available
  const structuredVars = test.results_structured
    ? (test.results_structured as Record<string, Record<string, number>>).variables ?? null
    : null;
  const hasResults = done && (test.results_note || structuredVars);

  return (
    <div style={{
      background: done ? tc + "12" : C.s2,
      border: "1px solid " + (done ? tc + "40" : C.brd),
      borderRadius: 7, overflow: "hidden",
    }}>
      {/* Header */}
      <div
        onClick={hasResults ? () => setOpen(v => !v) : undefined}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 7px", cursor: hasResults ? "pointer" : "default" }}
      >
        <span style={{ fontSize: 9, color: tc, flexShrink: 0 }}>🧪</span>
        <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: done ? C.tx : C.tx3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {test.title}
        </span>
        <span style={{ fontSize: 8, fontWeight: 700, color: done ? tc : C.tx3, flexShrink: 0 }}>
          {done ? "✓" : "—"}
        </span>
        {hasResults && (open ? <ChevronUp size={9} color={C.tx3} /> : <ChevronDown size={9} color={C.tx3} />)}
      </div>

      {/* Expanded: results */}
      {hasResults && open && (
        <div style={{ borderTop: "1px solid " + tc + "30", padding: "6px 7px", display: "flex", flexDirection: "column", gap: 4 }}>
          {/* Type badge */}
          <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: tc + "20", color: tc, textTransform: "capitalize", alignSelf: "flex-start" as const }}>
            {test.type}
          </span>

          {test.results_note && (
            <div style={{ fontSize: 9, color: C.tx2, lineHeight: 1.4 }}>
              {test.results_note}
            </div>
          )}

          {!test.results_note && !structuredVars && (
            <span style={{ fontSize: 9, color: C.tx3, fontStyle: "italic" }}>Aucun résultat saisi</span>
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

export function DayColumn({ date, workouts, energy, tests, wellness, previousWorkouts, rescheduledWorkoutIds, rescheduledEnergyIds, freeActivities = [] }: DayColumnProps) {
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
          <div style={{ fontSize: 10, fontWeight: 600, color: today ? C.ac : C.tx3, textTransform: "capitalize", marginBottom: 1 }}>
            {dayLabel}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: today ? C.ac : C.tx }}>
            {dayNum}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "8px 6px", display: "flex", flexDirection: "column", gap: 6 }}>

          {/* Wellness */}
          {wellness ? (
            <WellnessBlock wellness={wellness} onClick={() => setShowWellness(true)} />
          ) : (
            <div style={{ textAlign: "center", padding: "5px 0" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.brd, margin: "0 auto 3px" }} />
              <span style={{ fontSize: 8, color: C.tx3 }}>—</span>
            </div>
          )}

          {/* Workouts */}
          {workouts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {workouts.map(w => (
                <WorkoutRow
                  key={w.id}
                  workout={w}
                  prevWorkout={previousWorkouts?.find(pw => pw.session_name === w.session_name) ?? null}
                  isRescheduled={rescheduledWorkoutIds?.has(w.id)}
                />
              ))}
            </div>
          )}

          {/* Energy sessions */}
          {energy.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {energy.map(e => (
                <EnergyRow key={e.id} session={e} isRescheduled={rescheduledEnergyIds?.has(e.id)} />
              ))}
            </div>
          )}

          {/* Tests */}
          {tests.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {tests.map(t => (
                <TestRow key={t.id} test={t} />
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
          {workouts.length === 0 && energy.length === 0 && tests.length === 0 && freeActivities.length === 0 && !wellness && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, color: C.tx3 }}>Repos</span>
            </div>
          )}
        </div>
      </div>

      {/* Wellness detail overlay */}
      {showWellness && wellness && (
        <DayDetailPanel date={date} wellness={wellness} onClose={() => setShowWellness(false)} />
      )}
    </>
  );
}
