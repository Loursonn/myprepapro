import { useParams, useNavigate } from "react-router-dom";
import { C } from "@/lib/theme";
import { useWorkoutDetail } from "@/features/shared/hooks/useWorkoutDetail";
import { useUpdateSet } from "@/features/shared/hooks/useUpdateSet";
import { useCompleteWorkout } from "@/features/shared/hooks/useCompleteWorkout";
import type { SetRow } from "@/features/shared/types/athlete";

function haptic() {
  if (navigator.vibrate) navigator.vibrate(10);
}

// ── Set row editor ────────────────────────────────────────────────────────────

interface SetEditorProps {
  setNum: number;
  set: SetRow;
  onChange: (s: SetRow) => void;
}

function SetEditor({ setNum, set, onChange }: SetEditorProps) {
  const doneColor = set.done ? C.g : C.tx3;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 0", borderBottom: "1px solid " + C.brd,
      }}
    >
      {/* Done toggle */}
      <button
        onClick={() => { onChange({ ...set, done: !set.done }); haptic(); }}
        style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          border: "1px solid " + (set.done ? C.g + "50" : C.brdL),
          background: set.done ? C.gS : "transparent",
          color: doneColor, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center",
          minWidth: 44, minHeight: 44,
        }}
      >
        {set.done ? "✓" : setNum}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { session, exercises, isCompleted } = useWorkoutDetail(id ?? "");
  const { mutate: updateSet } = useUpdateSet();
  const { mutate: completeWorkout } = useCompleteWorkout();

  if (!session) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: C.tx3, fontSize: 13 }}>
        Séance introuvable
      </div>
    );
  }

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
          exercises.map(({ exercise, sets }) => {
            const exSets = sets.length > 0
              ? sets
              : Array.from({ length: exercise.weeks?.[1]?.sets ?? 3 }, (): SetRow => ({}));

            return (
              <div
                key={exercise.id}
                style={{
                  background: "#0F1014", borderRadius: 14,
                  border: "1px solid #1A1B22", overflow: "hidden",
                }}
              >
                {/* Exercise header */}
                <div style={{ padding: "12px 14px", borderBottom: "1px solid " + C.brd }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{exercise.name}</div>
                  {exercise.bloc && (
                    <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>{exercise.bloc}</div>
                  )}
                </div>

                {/* Sets */}
                <div style={{ padding: "0 14px" }}>
                  {exSets.map((s, i) => (
                    <SetEditor
                      key={i}
                      setNum={i + 1}
                      set={s}
                      onChange={(newSet) => {
                        const key = `${exercise.id}_${1}`; // currentWeek handled in hook
                        const newSets = [...exSets];
                        newSets[i] = newSet;
                        updateSet(key, newSets);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })
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
            completeWorkout(session.id);
            navigate(-1);
          }}
          disabled={isCompleted}
          style={{
            width: "100%", maxWidth: 480, padding: "16px 0", borderRadius: 16,
            border: "none",
            background: isCompleted ? C.s2 : C.coach,
            color: isCompleted ? C.tx3 : "#fff",
            fontSize: 14, fontWeight: 700, cursor: isCompleted ? "default" : "pointer",
            fontFamily: "inherit", minHeight: 44,
            boxShadow: isCompleted ? "none" : "0 4px 20px rgba(212,83,142,0.35)",
          }}
        >
          {isCompleted ? "Séance déjà complétée ✓" : "Terminer la séance 🏁"}
        </button>
      </div>
    </div>
  );
}
