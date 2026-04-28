import { useState } from "react";
import { useSearchParams } from "react-router-dom";
// view driven by ContextBar sub-tabs via ?view= param
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/features/shared/components/StatusPill";
import { EmptyState } from "@/features/shared/components/EmptyState";
import { CalendarDays } from "lucide-react";

import CoachFourWeekCalendar from "@/components/coach/CoachFourWeekCalendar";
import { CoachProgramEditor, CoachExoParams } from "@/components/coach/CoachProgramEditor";
import { CoachEnergyProgram } from "@/components/coach/CoachComponents";
import { NewBlockModal } from "@/components/coach/CoachComponents";
import BlockHistoryViewer from "@/features/coach/components/BlockHistoryViewer";
import { TierConfigModal } from "@/components/coach/CoachComponents";
import WeekCalendar from "@/components/coach/WeekCalendar";
// ── View types ────────────────────────────────────────────────────────────────

type ProgView = "block" | "week" | "day";

// ── ProgrammationPage ─────────────────────────────────────────────────────────

export default function ProgrammationPage() {
  const [searchParams] = useSearchParams();
  const view = (searchParams.get("view") as ProgView) ?? "block";

  const { user } = useAuth();
  const {
    athleteId, loaded, viewOnly,
    exos, setExos, sessions, setSessions, blockConfig, setBlockConfig,
    completedSessions, currentWeek, tw, dw, weeksArr, allMethods,
    customMethods, setCustomMethods, exMeta, setExMeta, sets,
    weekSchedule, setWeekSchedule, athleteNotes,
    energySessions, setEnergySessions, energyWeekPlan, setEnergyWeekPlan,
    energyDayPlan, setEnergyDayPlan, energyEditorKey, setEnergyEditorKey,
    energySessionsLoaded, setEnergySessionsLoaded,
    testSessions, visibilitySettings, setVisibilitySettings,
    wellnessHistory, sessionLogs, weightLog, nutritionLog,
    showNewBlock, setShowNewBlock, showBlockHistory, setShowBlockHistory,
    showTierModal, setShowTierModal, blockHistory, setBlockHistory,
    archiveAndNewBlock, updateSessionDay, updateSessionWeekDay,
  } = useAthleteContext();

  const [progSubTab, setProgSubTab] = useState("muscu");
  const [showExoParams, setShowExoParams] = useState(false);

  function setView(v: ProgView) {
    setSearchParams({ view: v });
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

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
      {/* ── BLOC ──────────────────────────────────────────────────────────── */}
      {view === "block" && (
        <>
          {/* 4-week calendar */}
          <CoachFourWeekCalendar
            sessions={sessions}
            completedSessions={completedSessions}
            currentWeek={currentWeek}
            C={C}
            wellnessHistory={wellnessHistory}
            sessionLogs={sessionLogs}
            energySessions={energySessions}
            energyWeekPlan={energyWeekPlan}
            energyDayPlan={energyDayPlan}
            setEnergyWeekPlan={setEnergyWeekPlan}
            setEnergyDayPlan={setEnergyDayPlan}
            testSessions={testSessions}
            visibilitySettings={visibilitySettings}
            onUpdateSessionDay={updateSessionDay}
            onUpdateSessionWeekDay={updateSessionWeekDay}
            onUpdateVisibility={setVisibilitySettings}
            athleteId={athleteId}
            blockConfig={blockConfig}
            weekSchedule={weekSchedule}
            setWeekSchedule={setWeekSchedule}
            exos={exos}
            allMethods={allMethods}
          />

          {/* Sub-tabs: Muscu / Énergie / Spécifique */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid " + C.brd, margin: "16px 0 16px" }}>
            {[
              { k: "muscu",         l: "Musculation"   },
              { k: "energie",       l: "Énergétique"   },
              { k: "specifique",    l: "Spécifique"    },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => { setProgSubTab(t.k); setEnergyEditorKey(null); }}
                style={{
                  padding: "9px 18px", border: "none",
                  borderBottom: "2px solid " + (progSubTab === t.k ? C.coach : "transparent"),
                  background: "transparent",
                  color: progSubTab === t.k ? C.coach : C.tx3,
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

          {progSubTab === "muscu" && (
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
                  weekSchedule={weekSchedule} setWeekSchedule={setWeekSchedule}
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
          {progSubTab === "energie" && (
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
          {progSubTab === "specifique" && (
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
        </>
      )}

      {/* ── SEMAINE ───────────────────────────────────────────────────────── */}
      {view === "week" && (
        <WeekCalendar
          sessions={sessions}
          completedSessions={completedSessions}
          currentWeek={currentWeek}
          weekSchedule={weekSchedule}
          setWeekSchedule={setWeekSchedule}
          C={C}
          wellnessHistory={wellnessHistory}
          weightLog={weightLog}
          sessionLogs={sessionLogs}
          nutritionLog={nutritionLog}
          exos={exos}
          energySessions={energySessions}
          energyWeekPlan={energyWeekPlan}
          energyDayPlan={energyDayPlan}
          testSessions={testSessions}
          visibilitySettings={visibilitySettings}
        />
      )}

      {/* ── JOUR ──────────────────────────────────────────────────────────── */}
      {view === "day" && (
        <DayView
          sessions={sessions}
          exos={exos}
          completedSessions={completedSessions}
          currentWeek={currentWeek}
        />
      )}
    </div>
  );
}

// ── DayView ───────────────────────────────────────────────────────────────────

interface DayViewProps {
  sessions: ReturnType<typeof useAthleteContext>["sessions"];
  exos: ReturnType<typeof useAthleteContext>["exos"];
  completedSessions: ReturnType<typeof useAthleteContext>["completedSessions"];
  currentWeek: number;
}

function DayView({ sessions, exos, completedSessions, currentWeek }: DayViewProps) {
  const todayDow = (new Date().getDay() + 6) % 7;
  const DOW_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const [selectedDow, setSelectedDow] = useState(todayDow);

  const daySessions = sessions.filter(
    (s) => s.day_of_week === selectedDow && (exos[s.id] || []).length > 0,
  );
  const doneSessions = completedSessions[currentWeek] || [];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto" }}>
        {DOW_LABELS.map((label, dow) => {
          const active = dow === selectedDow;
          const isToday = dow === todayDow;
          return (
            <button
              key={dow}
              onClick={() => setSelectedDow(dow)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 3, padding: "8px 12px", borderRadius: 10,
                border: "1px solid " + (active ? C.ac : C.brdL),
                background: active ? C.acS : C.s1,
                color: active ? C.ac : isToday ? C.tx : C.tx3,
                fontSize: 11, fontWeight: active ? 700 : 400,
                cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                transition: "all 150ms",
              }}
            >
              {label}
              {isToday && (
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: active ? C.ac : C.tx3 }} />
              )}
            </button>
          );
        })}
      </div>

      {daySessions.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Aucune séance ce jour"
          description="Aucune séance planifiée pour ce jour dans le bloc actif."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {daySessions.map((sess) => {
            const done = doneSessions.includes(sess.id);
            const exercises = exos[sess.id] || [];
            return (
              <div
                key={sess.id}
                style={{
                  background: C.s1, borderRadius: 14, padding: 16,
                  border: "1px solid " + (done ? C.g + "40" : C.brdL),
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: done ? C.g : C.tx, flex: 1 }}>
                    {sess.name || sess.label}
                  </div>
                  <StatusPill status={done ? "completed" : "planned"} size="sm" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {exercises.slice(0, 5).map((ex, i) => (
                    <div key={i} style={{ fontSize: 12, color: C.tx2, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 9, color: C.tx3 }}>•</span>
                      {ex.name}
                      {ex.weeks?.[currentWeek] && (
                        <span style={{ fontSize: 10, color: C.tx3 }}>
                          {ex.weeks[currentWeek].sets}×{ex.weeks[currentWeek].repsRange}
                          {ex.weeks[currentWeek].kg ? ` @ ${ex.weeks[currentWeek].kg}kg` : ""}
                        </span>
                      )}
                    </div>
                  ))}
                  {exercises.length > 5 && (
                    <div style={{ fontSize: 11, color: C.tx3 }}>+{exercises.length - 5} exercices</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
