import { useState } from "react";
import { useLocation } from "react-router-dom";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import LogView from "@/components/athlete/LogView";
import EnergySessionLog from "@/components/athlete/EnergySessionLog";
import { RpeSheet } from "@/features/athlete/components/RpeSheet";

export default function LogSeancePage() {
  const location = useLocation();
  const initialSess = (location.state as { initialSess?: unknown } | null)?.initialSess ?? null;
  const [logSubTab, setLogSubTab] = useState("muscu");
  const [rpeSessionId, setRpeSessionId] = useState<string | null>(null);

  const {
    athleteId, viewOnly, exos, sets, updSets, completedSessions, completeSession,
    uncompleteSession, goals, weeklyTarget, currentWeek, allMethods, athleteNotes,
    setAthleteNotes, sessions, blockConfig, sessionLogs, setSessionLogs,
    freeSessions, setFreeSessions, weekSchedule, setExos,
    timerLeft, timerDur, timerActive, timerFinished,
    timerSetDur, timerStart, timerStop,
  } = useAthleteContext();

  return (
    <>
      {/* Sub-tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid " + C.brd, background: C.bg, paddingLeft: 16, paddingRight: 16, gap: 0 }}>
        {[{ k: "muscu", l: "Musculation" }, { k: "energie", l: "Énergétique" }, { k: "specifique", l: "Spécifique" }].map(t => (
          <button key={t.k} onClick={() => setLogSubTab(t.k)} style={{ padding: "10px 14px", border: "none", borderBottom: "2px solid " + (logSubTab === t.k ? C.ac : "transparent"), background: "transparent", color: logSubTab === t.k ? C.ac : C.tx3, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textTransform: "uppercase" as const, letterSpacing: "0.3px", flexShrink: 0 }}>{t.l}</button>
        ))}
      </div>

      {logSubTab === "muscu" && (
        <LogView
          exos={exos} sets={sets} updSets={updSets}
          completedSessions={completedSessions}
          completeSession={completeSession} uncompleteSession={uncompleteSession}
          goals={goals} weeklyTarget={weeklyTarget} currentWeek={currentWeek}
          allMethods={allMethods} athleteNotes={athleteNotes} setAthleteNotes={setAthleteNotes}
          sessions={sessions} blockConfig={blockConfig} initialSess={initialSess}
          timerLeft={timerLeft} timerDur={timerDur} timerActive={timerActive}
          timerFinished={timerFinished} onTimerSetDur={timerSetDur}
          onTimerStart={timerStart} onTimerStop={timerStop}
          viewOnly={viewOnly} sessionLogs={sessionLogs} setSessionLogs={setSessionLogs}
          freeSessions={freeSessions} setFreeSessions={setFreeSessions}
          onAddExercise={(sessId: string, ex: unknown) => setExos(prev => ({ ...prev, [sessId]: [...(prev[sessId] || []), ex] }))}
          weekSchedule={weekSchedule}
          onSessionCompleted={(sid: string) => setRpeSessionId(sid)}
        />
      )}

      {logSubTab === "energie" && (
        <EnergySessionLog athleteId={athleteId} viewOnly={viewOnly} C={C} />
      )}

      {rpeSessionId && (
        <RpeSheet sessionId={rpeSessionId} onClose={() => setRpeSessionId(null)} />
      )}

      {logSubTab === "specifique" && (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.tx, marginBottom: 6 }}>Séances Spécifiques</div>
          <div style={{ fontSize: 13, color: C.tx3 }}>Cette fonctionnalité sera disponible prochainement.</div>
        </div>
      )}
    </>
  );
}
