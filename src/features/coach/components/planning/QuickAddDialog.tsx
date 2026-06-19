import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Dumbbell, FlaskConical, Zap } from "lucide-react";
import { C } from "@/lib/theme";
import { useAssignWorkout, useCreateTestSession } from "@/features/shared/hooks/useUnifiedCalendar";
import { useEnergySessions } from "@/features/shared/hooks/useEnergySessions";
import { useAssignEnergySession } from "@/features/shared/hooks/useEnergyAssignments";
import { useTestDefinitions } from "@/features/shared/hooks/tests/useTestDefinitions";
import type { TestDefinitionWithVariables } from "@/features/shared/types/tests";

type Tab = "workout" | "energy" | "test";

const TAB_KEY = "quickadd_tab";

function getSavedTab(): Tab {
  try {
    const v = localStorage.getItem(TAB_KEY) as Tab | null;
    if (v === "workout" || v === "energy" || v === "test") return v;
  } catch {}
  return "workout";
}

// ── Test types ────────────────────────────────────────────────────────────────

const TEST_TYPES = ["musculation", "endurance", "vitesse", "puissance", "souplesse", "autre"] as const;

const KIND_LABEL: Record<string, string> = {
  vo2: "VO₂max", tempo: "Tempo", seuil: "Seuil",
  footing: "Footing", fartlek: "Fartlek", autre: "Autre", custom: "Custom",
};
const KIND_COLOR: Record<string, string> = {
  vo2: "#A855F7", tempo: "#3B8DF0", seuil: "#F59E0B",
  footing: "#10B981", fartlek: "#EF4444", autre: "#6B7280", custom: "#6B7280",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface QuickAddDialogProps {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  athleteId: string;
  coachId: string;
  sessions: Array<{ id: string; name: string }>;
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
  const [tab, setTab] = useState<Tab>(getSavedTab);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [selectedEnergy, setSelectedEnergy] = useState<string>("");
  const [energySearch, setEnergySearch] = useState("");
  const [testSearch, setTestSearch]       = useState("");
  const [selectedTestDef, setSelectedTestDef] = useState<TestDefinitionWithVariables | null>(null);
  const [testTitle, setTestTitle]         = useState("");
  const [testType, setTestType]           = useState<string>("musculation");

  const { mutate: assignWorkout,  isPending: pendingWorkout  } = useAssignWorkout();
  const { mutate: createTest,     isPending: pendingTest      } = useCreateTestSession();
  const { mutate: assignEnergy,   isPending: pendingEnergy    } = useAssignEnergySession();
  const { data: energySessions = [] } = useEnergySessions();
  const { data: testDefinitions = [] } = useTestDefinitions(coachId);

  if (!open || !date) return null;

  const dateStr   = format(date, "yyyy-MM-dd");
  const dateLabel = format(date, "d MMMM yyyy", { locale: fr });

  const filteredSessions = sessions.filter((s) =>
    s.name.toLowerCase().includes(sessionSearch.toLowerCase())
  );

  const filteredEnergy = energySessions.filter((s) =>
    s.name.toLowerCase().includes(energySearch.toLowerCase())
  );

  const filteredTests = testDefinitions.filter((d) =>
    d.name.toLowerCase().includes(testSearch.toLowerCase())
  );

  function switchTab(t: Tab) {
    setTab(t);
    try { localStorage.setItem(TAB_KEY, t); } catch {}
  }

  function handleWorkoutSubmit() {
    if (!selectedSession) return;
    const sess = sessions.find((s) => s.id === selectedSession);
    if (!sess) return;
    assignWorkout(
      { sessionId: sess.id, sessionName: sess.name, athleteId, coachId, date: dateStr },
      { onSuccess: handleClose },
    );
  }

  function handleEnergySubmit() {
    if (!selectedEnergy) return;
    assignEnergy(
      { energy_session_id: selectedEnergy, athlete_id: athleteId, coach_id: coachId, scheduled_date: dateStr, status: "planned" },
      { onSuccess: handleClose },
    );
  }

  function handleTestSubmit() {
    const title = testTitle.trim() || selectedTestDef?.name;
    if (!title) return;
    createTest(
      { athleteId, coachId, title, type: testType, date: dateStr },
      { onSuccess: handleClose },
    );
  }

  function handleClose() {
    setSelectedSession(""); setSessionSearch("");
    setSelectedEnergy("");  setEnergySearch("");
    setTestSearch(""); setSelectedTestDef(null); setTestTitle(""); setTestType("musculation");
    onClose();
  }

  const canSubmit =
    tab === "workout" ? !!selectedSession :
    tab === "energy"  ? !!selectedEnergy  :
    !!(selectedTestDef || testTitle.trim());
  const isPending =
    tab === "workout" ? pendingWorkout :
    tab === "energy"  ? pendingEnergy  :
    pendingTest;

  function handleSubmit() {
    if (tab === "workout") handleWorkoutSubmit();
    else if (tab === "energy") handleEnergySubmit();
    else handleTestSubmit();
  }

  const submitLabel =
    isPending ? "Ajout..." :
    tab === "workout" ? "Planifier séance" :
    tab === "energy"  ? "Planifier énergie" :
    "Créer test";

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
            { key: "workout", label: "Muscu",    Icon: Dumbbell     },
            { key: "energy",  label: "Énergie",  Icon: Zap          },
            { key: "test",    label: "Test",      Icon: FlaskConical },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
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
                placeholder="Rechercher dans la banque de séances..."
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 10,
                  border: "1px solid " + C.brdL, background: C.s2,
                  color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, scrollbarWidth: "none" }}>
                {filteredSessions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: C.tx3, fontSize: 12 }}>
                    {sessionSearch ? "Aucun résultat" : "Banque de séances vide — créez une séance dans l'onglet Programmation"}
                  </div>
                ) : (
                  filteredSessions.map((s) => {
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
                        {active && "✓ "}{s.name}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* ── ENERGY TAB ── */}
          {tab === "energy" && (
            <>
              <input
                value={energySearch}
                onChange={(e) => setEnergySearch(e.target.value)}
                placeholder="Rechercher une séance énergie..."
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 10,
                  border: "1px solid " + C.brdL, background: C.s2,
                  color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, scrollbarWidth: "none" }}>
                {filteredEnergy.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: C.tx3, fontSize: 12 }}>
                    Aucune séance énergie
                  </div>
                ) : (
                  filteredEnergy.map((s) => {
                    const active = selectedEnergy === s.id;
                    const kindColor = KIND_COLOR[s.session_kind] ?? "#6B7280";
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedEnergy(active ? "" : s.id)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 10,
                          border: "1px solid " + (active ? kindColor + "60" : C.brd),
                          background: active ? kindColor + "15" : C.s2,
                          color: active ? kindColor : C.tx,
                          fontSize: 13, fontWeight: active ? 600 : 400,
                          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                          transition: "all 120ms",
                          display: "flex", alignItems: "center", gap: 8,
                        }}
                      >
                        <span
                          style={{
                            padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                            background: kindColor + "25", color: kindColor,
                            flexShrink: 0,
                          }}
                        >
                          {KIND_LABEL[s.session_kind] ?? s.session_kind}
                        </span>
                        <span>{active && "✓ "}{s.name}</span>
                        {s.total_duration_s && (
                          <span style={{ marginLeft: "auto", fontSize: 10, color: C.tx3, flexShrink: 0 }}>
                            {Math.round(s.total_duration_s / 60)} min
                          </span>
                        )}
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
              {/* Bank picker */}
              <input
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                placeholder="Rechercher dans la banque de tests..."
                autoFocus
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 10,
                  border: "1px solid " + C.brdL, background: C.s2,
                  color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, scrollbarWidth: "none" }}>
                {filteredTests.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: C.tx3, fontSize: 12 }}>
                    {testSearch ? `Aucun test « ${testSearch} »` : "Banque de tests vide"}
                  </div>
                ) : (
                  filteredTests.map((def) => {
                    const active = selectedTestDef?.id === def.id;
                    return (
                      <button
                        key={def.id}
                        onClick={() => {
                          setSelectedTestDef(active ? null : def);
                          setTestTitle(active ? "" : def.name);
                        }}
                        style={{
                          width: "100%", padding: "9px 12px", borderRadius: 10,
                          border: "1px solid " + (active ? C.o + "60" : C.brd),
                          background: active ? C.oS : C.s2,
                          color: active ? C.o : C.tx,
                          fontSize: 13, fontWeight: active ? 600 : 400,
                          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                          transition: "all 120ms",
                          display: "flex", alignItems: "center", gap: 8,
                        }}
                      >
                        <span style={{ flex: 1 }}>{active && "✓ "}{def.name}</span>
                        {def.kind === "preset" && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: C.ac + "20", color: C.ac, flexShrink: 0 }}>
                            Officiel
                          </span>
                        )}
                        {def.test_variables.length > 0 && (
                          <span style={{ fontSize: 9, color: C.tx3, flexShrink: 0 }}>
                            {def.test_variables.length} var.
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Custom title (shown when bank empty or user wants to override) */}
              {(filteredTests.length === 0 || testTitle !== (selectedTestDef?.name ?? "")) && (
                <div>
                  <div style={{ fontSize: 10, color: C.tx3, marginBottom: 4 }}>
                    {selectedTestDef ? "Titre personnalisé" : "Ou saisir un titre libre"}
                  </div>
                  <input
                    value={testTitle}
                    onChange={(e) => { setTestTitle(e.target.value); if (selectedTestDef && e.target.value !== selectedTestDef.name) setSelectedTestDef(null); }}
                    placeholder="ex: VMA, 1RM Squat, 30-15..."
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 10,
                      border: "1px solid " + C.brdL, background: C.s2,
                      color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {/* Type */}
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
            onClick={handleSubmit}
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
            {submitLabel}
          </button>
        </div>
      </div>
    </>
  );
}
