import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Dumbbell, FlaskConical } from "lucide-react";
import { C } from "@/lib/theme";
import { useAssignWorkout, useCreateTestSession } from "@/features/shared/hooks/useCalendarEvents";

type Tab = "workout" | "test";

// ── Test types ────────────────────────────────────────────────────────────────

const TEST_TYPES = ["musculation", "endurance", "vitesse", "puissance", "souplesse", "autre"] as const;

// ── Props ─────────────────────────────────────────────────────────────────────

interface QuickAddDialogProps {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  athleteId: string;
  coachId: string;
  sessions: Array<{ id: string; name?: string; label?: string }>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuickAddDialog({
  open,
  onClose,
  date,
  athleteId,
  coachId,
  sessions,
}: QuickAddDialogProps) {
  const [tab, setTab] = useState<Tab>("workout");
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [testTitle, setTestTitle] = useState("");
  const [testType, setTestType] = useState<string>("musculation");

  const { mutate: assignWorkout, isPending: pendingWorkout } = useAssignWorkout();
  const { mutate: createTest, isPending: pendingTest }       = useCreateTestSession();

  if (!open || !date) return null;

  const dateStr  = format(date, "yyyy-MM-dd");
  const dateLabel = format(date, "d MMMM yyyy", { locale: fr });

  const filteredSessions = sessions.filter((s) => {
    const name = s.name ?? s.label ?? "";
    return name.toLowerCase().includes(sessionSearch.toLowerCase());
  });

  function handleWorkoutSubmit() {
    if (!selectedSession) return;
    const sess = sessions.find((s) => s.id === selectedSession);
    if (!sess) return;
    assignWorkout(
      {
        sessionId: sess.id,
        sessionName: sess.name ?? sess.label ?? "Séance",
        athleteId,
        coachId,
        date: dateStr,
      },
      { onSuccess: handleClose },
    );
  }

  function handleTestSubmit() {
    if (!testTitle.trim()) return;
    createTest(
      { athleteId, coachId, title: testTitle.trim(), type: testType, date: dateStr },
      { onSuccess: handleClose },
    );
  }

  function handleClose() {
    setSelectedSession("");
    setSessionSearch("");
    setTestTitle("");
    setTestType("musculation");
    onClose();
  }

  const canSubmit = tab === "workout" ? !!selectedSession : !!testTitle.trim();
  const isPending = tab === "workout" ? pendingWorkout : pendingTest;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)" }}
      />

      {/* Dialog */}
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", zIndex: 60,
          transform: "translate(-50%, -50%)",
          width: 460, maxWidth: "90vw",
          background: C.s1, borderRadius: 20,
          border: "1px solid " + C.brdL,
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          animation: "dialogIn 180ms ease-out",
        }}
      >
        <style>{`
          @keyframes dialogIn {
            from { opacity: 0; transform: translate(-50%,-50%) scale(0.96); }
            to   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            padding: "16px 20px", borderBottom: "1px solid " + C.brd,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.tx }}>Ajouter</div>
            <div style={{ fontSize: 11, color: C.tx3 }}>{dateLabel}</div>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: "1px solid " + C.brdL, background: "transparent",
              color: C.tx3, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            padding: "12px 20px 0",
            display: "flex", gap: 0,
            borderBottom: "1px solid " + C.brd,
          }}
        >
          {([
            { key: "workout", label: "Séance", Icon: Dumbbell },
            { key: "test",    label: "Test",   Icon: FlaskConical },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "8px 16px", border: "none", background: "transparent",
                color: tab === key ? C.ac : C.tx3,
                fontSize: 12, fontWeight: tab === key ? 600 : 400,
                cursor: "pointer", fontFamily: "inherit",
                borderBottom: "2px solid " + (tab === key ? C.ac : "transparent"),
                display: "flex", alignItems: "center", gap: 5,
                transition: "color 150ms",
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ── WORKOUT TAB ── */}
          {tab === "workout" && (
            <>
              <input
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                placeholder="Rechercher une séance du bloc..."
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 10,
                  border: "1px solid " + C.brdL, background: C.s2,
                  color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none",
                  boxSizing: "border-box",
                }}
              />

              <div
                style={{
                  maxHeight: 220, overflowY: "auto",
                  display: "flex", flexDirection: "column", gap: 4,
                  scrollbarWidth: "none",
                }}
              >
                {filteredSessions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: C.tx3, fontSize: 12 }}>
                    Aucune séance dans le bloc actif
                  </div>
                ) : (
                  filteredSessions.map((s) => {
                    const name = s.name ?? s.label ?? "Séance";
                    const active = selectedSession === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSession(active ? "" : s.id)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 10,
                          border: "1px solid " + (active ? C.ac + "60" : C.brd),
                          background: active ? C.acS : C.s2,
                          color: active ? C.ac : C.tx,
                          fontSize: 13, fontWeight: active ? 600 : 400,
                          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                          transition: "all 120ms",
                        }}
                      >
                        {active && "✓ "}{name}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* ── TEST TAB ── */}
          {tab === "test" && (
            <>
              <div>
                <div style={{ fontSize: 10, color: C.tx3, marginBottom: 4 }}>Nom du test</div>
                <input
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder="ex: VMA, 1RM Squat, 30-15..."
                  autoFocus
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 10,
                    border: "1px solid " + C.brdL, background: C.s2,
                    color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: 10, color: C.tx3, marginBottom: 6 }}>Type</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TEST_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTestType(t)}
                      style={{
                        padding: "5px 12px", borderRadius: 8,
                        border: "1px solid " + (testType === t ? C.o + "60" : C.brdL),
                        background: testType === t ? C.oS : "transparent",
                        color: testType === t ? C.o : C.tx3,
                        fontSize: 11, fontWeight: testType === t ? 600 : 400,
                        cursor: "pointer", fontFamily: "inherit",
                        transition: "all 120ms",
                        textTransform: "capitalize",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Submit */}
          <button
            onClick={tab === "workout" ? handleWorkoutSubmit : handleTestSubmit}
            disabled={!canSubmit || isPending}
            style={{
              width: "100%", padding: "13px 0", borderRadius: 12,
              border: "none",
              background: canSubmit && !isPending ? C.ac : C.s2,
              color: canSubmit && !isPending ? "#fff" : C.tx3,
              fontSize: 14, fontWeight: 700,
              cursor: canSubmit && !isPending ? "pointer" : "default",
              fontFamily: "inherit", marginTop: 4,
              transition: "all 150ms",
            }}
          >
            {isPending ? "Ajout..." : tab === "workout" ? "Planifier séance" : "Créer test"}
          </button>
        </div>
      </div>
    </>
  );
}
