import { useState } from "react";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Zap } from "lucide-react";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import LogView from "@/components/athlete/LogView";
import { useEnergyAssignments } from "@/features/shared/hooks/useEnergyAssignments";
import { RpeSheet } from "@/features/athlete/components/RpeSheet";

const KIND_COLOR: Record<string, string> = {
  vo2: "#A855F7", tempo: "#3B8DF0", seuil: "#F59E0B",
  footing: "#10B981", fartlek: "#EF4444", autre: "#6B7280", custom: "#6B7280",
};
const KIND_LABEL: Record<string, string> = {
  vo2: "VO₂max", tempo: "Tempo", seuil: "Seuil",
  footing: "Footing", fartlek: "Fartlek", autre: "Autre", custom: "Custom",
};

function EnergyAthleteView({ athleteId }: { athleteId: string }) {
  const { data: assignments = [], isLoading } = useEnergyAssignments(athleteId);
  const today = new Date().toISOString().split("T")[0];

  const upcoming = [...assignments]
    .filter((a) => (a.scheduled_date ?? "") >= today)
    .sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? ""));

  if (isLoading) {
    return <div style={{ padding: "24px 16px", textAlign: "center", color: C.tx3, fontSize: 13 }}>Chargement…</div>;
  }

  if (upcoming.length === 0) {
    return (
      <div style={{ padding: "48px 20px", textAlign: "center" }}>
        <Zap size={36} style={{ color: C.tx3, margin: "0 auto 12px" }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 4 }}>
          Aucune séance énergétique à venir
        </div>
        <div style={{ fontSize: 12, color: C.tx3 }}>
          Ton coach planifiera tes séances cardio ici.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
        Séances à venir
      </div>
      {upcoming.map((a) => {
        const session = (a as Record<string, unknown>).energy_sessions as {
          name: string; session_kind: string; total_duration_s?: number | null;
        } | null;
        const kind = session?.session_kind ?? "";
        const kindColor = KIND_COLOR[kind] ?? C.tx3;
        const dateStr = a.scheduled_date
          ? format(new Date(a.scheduled_date + "T12:00:00"), "EEE d MMM", { locale: fr })
          : "—";
        return (
          <div key={a.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 12, marginBottom: 8,
            border: "1px solid " + C.brdL, background: C.s1,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: kindColor + "20",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Zap size={16} color={kindColor} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 2 }}>
                {session?.name ?? "Séance énergie"}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 5,
                  background: kindColor + "20", color: kindColor,
                }}>
                  {KIND_LABEL[kind] ?? kind}
                </span>
                <span style={{ fontSize: 10, color: C.tx3 }}>{dateStr}</span>
                {session?.total_duration_s != null && (
                  <span style={{ fontSize: 10, color: C.tx3 }}>
                    {Math.round(session.total_duration_s / 60)} min
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LogSeancePage() {
  const location = useLocation();
  const initialSess = (location.state as { initialSess?: unknown } | null)?.initialSess ?? null;
  const [logSubTab, setLogSubTab] = useState("muscu");
  const [rpePending, setRpePending] = useState<{ sessionId: string; scheduledDate: string } | null>(null);

  const {
    athleteId, viewOnly, exos, sets, updSets, completedSessions, completeSession,
    uncompleteSession, goals, weeklyTarget, currentWeek, allMethods, athleteNotes,
    setAthleteNotes, sessions, blockConfig, sessionLogs, setSessionLogs,
    freeSessions, setFreeSessions, weekSchedule, setExos,
    timerLeft, timerDur, timerActive, timerFinished,
    timerSetDur, timerStart, timerStop,
  } = useAthleteContext();

  function computeScheduledDate(sessId: string, week: number): string {
    const sess = sessions.find(s => s.id === sessId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dow = (sess as any)?.weekDays?.[String(week)] ?? (sess as any)?.day_of_week;
    if (dow == null || !blockConfig?.startDate) return new Date().toISOString().split("T")[0];
    const d0 = new Date(blockConfig.startDate + "T12:00:00");
    const weekDow = d0.getDay();
    d0.setDate(d0.getDate() + (weekDow === 0 ? -6 : 1 - weekDow) + (week - 1) * 7 + (dow as number));
    return d0.toISOString().split("T")[0];
  }

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
          onSessionCompleted={(sid: string, wk: number) => setRpePending({ sessionId: sid, scheduledDate: computeScheduledDate(sid, wk) })}
        />
      )}

      {logSubTab === "energie" && (
        <EnergyAthleteView athleteId={athleteId} />
      )}

      {rpePending && (
        <RpeSheet
          sessionId={rpePending.sessionId}
          scheduledDate={rpePending.scheduledDate}
          onClose={() => setRpePending(null)}
        />
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
