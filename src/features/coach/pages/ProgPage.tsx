import { useState } from "react";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import CoachFourWeekCalendar from "@/components/coach/CoachFourWeekCalendar";
import { CoachProgramEditor, CoachExoParams } from "@/components/coach/CoachProgramEditor";
import { PlanningEditor } from "@/components/coach/PlanningEditor";
import { CoachEnergyProgram } from "@/components/coach/CoachComponents";
import { useAuth } from "@/hooks/useAuth";

export default function ProgPage() {
  const { user } = useAuth();
  const [progSubTab, setProgSubTab] = useState("muscu");
  const [showExoParams, setShowExoParams] = useState(false);
  const {
    athleteId, exos, setExos, sessions, setSessions, blockConfig, setBlockConfig,
    completedSessions, currentWeek, tw, dw, weeksArr, allMethods, customMethods,
    setCustomMethods, exMeta, setExMeta, sets, weekSchedule, setWeekSchedule,
    athleteNotes, energySessions, energyWeekPlan, setEnergyWeekPlan,
    energyDayPlan, setEnergyDayPlan, energyEditorKey, setEnergyEditorKey,
    energySessionsLoaded, setEnergySessionsLoaded, testSessions, visibilitySettings,
    setVisibilitySettings, wellnessHistory, sessionLogs,
    showNewBlock, setShowNewBlock, showBlockHistory, setShowBlockHistory, showTierModal, setShowTierModal,
    blockHistory, setBlockHistory,
    updateSessionDay, updateSessionWeekDay,
  } = useAthleteContext();

  // testSessions lives in context but loaded by the hook below
  const ctx = useAthleteContext() as unknown as Record<string, unknown>;
  const testSessionsData = (ctx.testSessions as typeof testSessions) ?? [];

  return (
    <>
      {/* ── Block config header ── */}
      <div style={{ background: C.s1, borderRadius: 14, padding: "12px 16px", border: "1px solid " + C.b + "30", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.b, textTransform: "uppercase", letterSpacing: "0.5px" }}>Bloc d'entraînement</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowNewBlock(true)} style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid " + C.coach + "40", background: C.coachS, color: C.coach, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Nouveau bloc</button>
            <button onClick={() => setShowBlockHistory(true)} style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", position: "relative" }}>
              Historique{blockHistory.length > 0 && <span style={{ position: "absolute", top: -3, right: -3, background: C.ac, color: "#fff", fontSize: 8, fontWeight: 800, width: 13, height: 13, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{blockHistory.length}</span>}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={blockConfig?.blockName || ""} onChange={e => setBlockConfig((c: typeof blockConfig) => ({ ...c, blockName: e.target.value }))} placeholder="Nom du bloc..." style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontWeight: 600, fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" as const }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: C.tx3, flexShrink: 0 }}>Début</span>
            <input type="date" value={blockConfig?.startDate || ""} onChange={e => setBlockConfig((c: typeof blockConfig) => ({ ...c, startDate: e.target.value || null }))} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid " + (blockConfig?.startDate ? C.brdL : C.o + "60"), background: C.s2, color: blockConfig?.startDate ? C.tx : C.o, fontSize: 12, fontFamily: "inherit" }} />
          </div>
          {blockConfig?.startDate && (() => { const end = new Date(new Date(blockConfig.startDate!).getTime() + tw * 7 * 86400000); const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }); return <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: C.s2 }}><span style={{ fontSize: 10, color: C.tx3 }}>Fin</span><span style={{ fontSize: 11, fontWeight: 700, color: C.b }}>{fmt(end)}</span></div>; })()}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, background: C.s2, border: "1px solid " + C.brd }}>
            <span style={{ fontSize: 10, color: C.tx3 }}>Durée</span>
            <button onClick={() => setBlockConfig((c: typeof blockConfig) => ({ ...c, totalWeeks: Math.max(3, c.totalWeeks - 1) }))} style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid " + C.brdL, background: "transparent", color: C.tx2, fontSize: 14, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}>-</button>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.b, minWidth: 36, textAlign: "center" as const }}>{tw}sem</span>
            <button onClick={() => setBlockConfig((c: typeof blockConfig) => ({ ...c, totalWeeks: Math.min(16, c.totalWeeks + 1) }))} style={{ width: 22, height: 22, borderRadius: 5, border: "1px solid " + C.brdL, background: "transparent", color: C.tx2, fontSize: 14, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}>+</button>
          </div>
          {blockConfig?.startDate && (() => { const days = Math.floor((Date.now() - new Date(blockConfig.startDate!).getTime()) / 86400000); const wk = Math.min(Math.max(1, Math.floor(days / 7) + 1), tw); return <span style={{ fontSize: 10, color: C.g, padding: "5px 8px", borderRadius: 7, background: C.gS, fontWeight: 600 }}>S{wk} · J{days + 1}</span>; })()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
          <span style={{ fontSize: 10, color: C.tx3, flexShrink: 0 }}>Deload :</span>
          {weeksArr.map(w => { const isDL = dw === w; return <button key={w} onClick={() => setBlockConfig((c: typeof blockConfig) => ({ ...c, deloadWeek: c.deloadWeek === w ? 0 : w }))} style={{ padding: "4px 9px", borderRadius: 6, border: "1px solid " + (isDL ? C.b + "60" : C.brdL), background: isDL ? C.bS : "transparent", color: isDL ? C.b : C.tx3, fontSize: 10, fontWeight: isDL ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>S{w}</button>; })}
          {dw > 0 && <button onClick={() => setBlockConfig((c: typeof blockConfig) => ({ ...c, deloadWeek: 0 }))} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid " + C.r + "40", background: "transparent", color: C.r, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>✕</button>}
        </div>
      </div>

      {/* ── Planning calendar ── */}
      <CoachFourWeekCalendar sessions={sessions} completedSessions={completedSessions} currentWeek={currentWeek} C={C} wellnessHistory={wellnessHistory} sessionLogs={sessionLogs} energySessions={energySessions} energyWeekPlan={energyWeekPlan} energyDayPlan={energyDayPlan} setEnergyWeekPlan={setEnergyWeekPlan} setEnergyDayPlan={setEnergyDayPlan} testSessions={testSessionsData} visibilitySettings={visibilitySettings} onUpdateSessionDay={updateSessionDay} onUpdateSessionWeekDay={updateSessionWeekDay} onUpdateVisibility={setVisibilitySettings} athleteId={athleteId} blockConfig={blockConfig} weekSchedule={weekSchedule} setWeekSchedule={setWeekSchedule} exos={exos} allMethods={allMethods} />

      {/* ── Sub-tabs ── */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid " + C.brd, marginBottom: 16 }}>
        {[{ k: "planification", l: "Planification" }, { k: "muscu", l: "Musculation" }, { k: "energie", l: "Énergétique" }, { k: "specifique", l: "Spécifique" }].map(t => (
          <button key={t.k} onClick={() => { setProgSubTab(t.k); setEnergyEditorKey(null); }} style={{ padding: "9px 18px", border: "none", borderBottom: "2px solid " + (progSubTab === t.k ? C.coach : "transparent"), background: "transparent", color: progSubTab === t.k ? C.coach : C.tx3, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" as const, letterSpacing: "0.3px", flexShrink: 0 }}>{t.l}</button>
        ))}
      </div>

      {progSubTab === "planification" && <PlanningEditor athleteId={athleteId} coachId={user?.id} sessions={sessions} />}
      {progSubTab === "muscu" && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Musculation{blockConfig?.blockName && <span style={{ fontSize: 11, color: C.b, fontWeight: 600, marginLeft: 8 }}>{blockConfig.blockName} · {tw} sem.</span>}</div>
            <button onClick={() => setShowTierModal(true)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid " + C.o + "40", background: C.o + "12", color: C.o, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>⚙ Surcharge</button>
          </div>
          {sessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Aucun bloc actif</div>
              <div style={{ fontSize: 12, color: C.tx3, marginBottom: 16 }}>Crée un nouveau bloc pour commencer à planifier.</div>
              <button onClick={() => setShowNewBlock(true)} style={{ padding: "12px 24px", borderRadius: 12, border: "none", background: C.coach, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Créer un bloc</button>
            </div>
          ) : (
            <CoachProgramEditor exos={exos} setExos={setExos} sessions={sessions} setSessions={setSessions} athleteNotes={athleteNotes} allMethods={allMethods} customMethods={customMethods} setCustomMethods={setCustomMethods} blockConfig={blockConfig} exMeta={exMeta} setExMeta={setExMeta} currentWeek={currentWeek} sets={sets} completedSessions={completedSessions} weekSchedule={weekSchedule} setWeekSchedule={setWeekSchedule} />
          )}
          {sessions.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid " + C.brd }}>
              <button onClick={() => setShowExoParams(p => !p)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid " + C.brdL, background: showExoParams ? C.acS : "transparent", color: showExoParams ? C.ac : C.tx2, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: showExoParams ? 12 : 0 }}>
                ⚙ Paramètres exercices{showExoParams ? " ∧" : " ∨"}
              </button>
              {showExoParams && <CoachExoParams exMeta={exMeta} setExMeta={setExMeta} exos={exos} setExos={setExos} blockConfig={blockConfig} />}
            </div>
          )}
        </>
      )}
      {progSubTab === "energie" && (
        <CoachEnergyProgram athleteId={athleteId} energyEditorKey={energyEditorKey} setEnergyEditorKey={setEnergyEditorKey} energySessions={energySessions} setEnergySessions={setEnergySessions} energySessionsLoaded={energySessionsLoaded} setEnergySessionsLoaded={setEnergySessionsLoaded} C={C} blockConfig={blockConfig} currentWeek={currentWeek} weekPlan={energyWeekPlan} setWeekPlan={setEnergyWeekPlan} dayPlan={energyDayPlan} setDayPlan={setEnergyDayPlan} />
      )}
      {progSubTab === "specifique" && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Séances Spécifiques</div>
          <div style={{ fontSize: 12, color: C.tx3 }}>Planification des séances spécifiques à venir prochainement.</div>
        </div>
      )}
    </>
  );
}
