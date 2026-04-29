import { useState } from "react";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { Skeleton } from "@/components/ui/skeleton";

import { CoachProgramEditor, CoachExoParams } from "@/components/coach/CoachProgramEditor";
import { CoachEnergyProgram } from "@/components/coach/CoachComponents";
import { NewBlockModal } from "@/components/coach/CoachComponents";
import BlockHistoryViewer from "@/features/coach/components/BlockHistoryViewer";
import { TierConfigModal } from "@/components/coach/CoachComponents";

// ── ProgrammationPage ─────────────────────────────────────────────────────────

export default function ProgrammationPage() {
  const {
    athleteId, loaded, viewOnly,
    exos, setExos, sessions, setSessions, blockConfig, setBlockConfig,
    completedSessions, currentWeek, allMethods,
    customMethods, setCustomMethods, exMeta, setExMeta, sets,
    athleteNotes,
    energySessions, setEnergySessions, energyWeekPlan, setEnergyWeekPlan,
    energyDayPlan, setEnergyDayPlan, energyEditorKey, setEnergyEditorKey,
    energySessionsLoaded, setEnergySessionsLoaded,
    showNewBlock, setShowNewBlock, showBlockHistory, setShowBlockHistory,
    showTierModal, setShowTierModal, blockHistory, setBlockHistory,
    archiveAndNewBlock,
  } = useAthleteContext();

  const [subTab, setSubTab] = useState("muscu");
  const [showExoParams, setShowExoParams] = useState(false);

  if (!loaded) {
    return (
      <div style={{ padding: "16px 24px" }}>
        <Skeleton style={{ height: 120, borderRadius: 14, background: C.s1, marginBottom: 12 }} />
        <Skeleton style={{ height: 300, borderRadius: 14, background: C.s1 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 24px 60px" }}>

      {/* Sub-tabs: Muscu / Énergie / Spécifique */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid " + C.brd, marginBottom: 16 }}>
        {[
          { k: "muscu",      l: "Musculation" },
          { k: "energie",    l: "Énergétique" },
          { k: "specifique", l: "Spécifique"  },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => { setSubTab(t.k); setEnergyEditorKey(null); }}
            style={{
              padding: "9px 18px", border: "none",
              borderBottom: "2px solid " + (subTab === t.k ? C.coach : "transparent"),
              background: "transparent",
              color: subTab === t.k ? C.coach : C.tx3,
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", textTransform: "uppercase",
              letterSpacing: "0.3px", flexShrink: 0,
              transition: "color 150ms, border-color 150ms",
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* ── Musculation ────────────────────────────────────────────────────── */}
      {subTab === "muscu" && (
        sessions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Aucun bloc actif</div>
            <div style={{ fontSize: 12, color: C.tx3, marginBottom: 16 }}>Crée un nouveau bloc pour commencer.</div>
            {!viewOnly && (
              <button
                onClick={() => setShowNewBlock(true)}
                style={{
                  padding: "12px 24px", borderRadius: 12, border: "none",
                  background: C.coach, color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Créer un bloc
              </button>
            )}
          </div>
        ) : (
          <>
            <CoachProgramEditor
              exos={exos} setExos={setExos}
              sessions={sessions} setSessions={setSessions}
              athleteNotes={athleteNotes} allMethods={allMethods}
              customMethods={customMethods} setCustomMethods={setCustomMethods}
              blockConfig={blockConfig} exMeta={exMeta} setExMeta={setExMeta}
              currentWeek={currentWeek} sets={sets}
              completedSessions={completedSessions}
            />
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid " + C.brd }}>
              <button
                onClick={() => setShowExoParams((p) => !p)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 10,
                  border: "1px solid " + C.brdL,
                  background: showExoParams ? C.acS : "transparent",
                  color: showExoParams ? C.ac : C.tx2,
                  fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  marginBottom: showExoParams ? 12 : 0,
                }}
              >
                ⚙ Paramètres exercices{showExoParams ? " ∧" : " ∨"}
              </button>
              {showExoParams && (
                <CoachExoParams
                  exMeta={exMeta} setExMeta={setExMeta}
                  exos={exos} setExos={setExos}
                  blockConfig={blockConfig}
                />
              )}
            </div>
          </>
        )
      )}

      {/* ── Énergétique ───────────────────────────────────────────────────── */}
      {subTab === "energie" && (
        <CoachEnergyProgram
          athleteId={athleteId}
          energyEditorKey={energyEditorKey} setEnergyEditorKey={setEnergyEditorKey}
          energySessions={energySessions} setEnergySessions={setEnergySessions}
          energySessionsLoaded={energySessionsLoaded}
          setEnergySessionsLoaded={setEnergySessionsLoaded}
          C={C} blockConfig={blockConfig} currentWeek={currentWeek}
          weekPlan={energyWeekPlan} setWeekPlan={setEnergyWeekPlan}
          dayPlan={energyDayPlan} setDayPlan={setEnergyDayPlan}
        />
      )}

      {/* ── Spécifique ────────────────────────────────────────────────────── */}
      {subTab === "specifique" && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>Séances Spécifiques</div>
          <div style={{ fontSize: 12, color: C.tx3, marginTop: 4 }}>Disponible prochainement.</div>
        </div>
      )}

      {/* Modals */}
      {showNewBlock && (
        <NewBlockModal
          onStart={archiveAndNewBlock}
          onClose={() => setShowNewBlock(false)}
          onResume={() => setShowNewBlock(false)}
          hasCurrentData={sessions.length > 0 && Object.values(exos).flat().length > 0}
          blockHistory={blockHistory}
          onDelete={(idx) => setBlockHistory(blockHistory.filter((_, i) => i !== idx))}
        />
      )}
      {showBlockHistory && (
        <BlockHistoryViewer
          blockHistory={blockHistory}
          onClose={() => setShowBlockHistory(false)}
          onDelete={(idx) => setBlockHistory(blockHistory.filter((_, i) => i !== idx))}
        />
      )}
      {showTierModal && (
        <TierConfigModal
          blockConfig={blockConfig}
          setBlockConfig={setBlockConfig}
          onClose={() => setShowTierModal(false)}
        />
      )}
    </div>
  );
}
