import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CompetitionFormModal } from "@/features/coach/components/planning/CompetitionFormModal";

// Vue Saison
import { PlanningOverview } from "@/components/coach/PlanningOverview";

// Vue Frise
import { TimelineView } from "@/features/coach/components/planning/TimelineView";
import { CalendarMonthView } from "@/features/coach/components/planning/CalendarMonthView";
import { SummaryView } from "@/features/coach/components/planning/SummaryView";
import { CompetitionsView } from "@/features/coach/components/planning/CompetitionsView";

// Vue Énergétique
import { EnergyCalendarView } from "@/features/coach/components/energy/EnergyCalendarView";

// ── View types ────────────────────────────────────────────────────────────────

type PlanView = "season" | "timeline" | "month" | "summary" | "competitions";
type PlanType = "muscu" | "energy";

// ── PlanningPage ──────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get("view") as PlanView) ?? "season";
  const planType = (searchParams.get("type") as PlanType) ?? "muscu";

  const { user } = useAuth();
  const { athleteId, loaded, sessions, blockConfig, setBlockConfig, exos, sets, completedSessions, currentWeek, wellnessHistory, nutritionLog } = useAthleteContext();
  const [showCompForm, setShowCompForm] = useState(false);

  function handleTypeChange(value: string) {
    const params = new URLSearchParams(searchParams);
    params.set("type", value);
    setSearchParams(params, { replace: true });
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <div style={{ padding: "16px 24px" }}>
        <Skeleton style={{ height: 300, borderRadius: 14, background: C.s1 }} />
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: "16px 24px 60px" }}>
        {/* ── TYPE TABS ─────────────────────────────────────────────────────── */}
        <Tabs value={planType} onValueChange={handleTypeChange}>
          <TabsList
            style={{
              background: C.s2,
              border: `1px solid ${C.brd}`,
              borderRadius: 10,
              padding: 3,
              marginBottom: 20,
              display: "inline-flex",
              gap: 2,
            }}
          >
            <TabsTrigger
              value="muscu"
              style={{
                borderRadius: 8,
                padding: "6px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: planType === "muscu" ? C.tx : C.tx3,
                background: planType === "muscu" ? C.s1 : "transparent",
                border: planType === "muscu" ? `1px solid ${C.brdL}` : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              Musculation
            </TabsTrigger>
            <TabsTrigger
              value="energy"
              style={{
                borderRadius: 8,
                padding: "6px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: planType === "energy" ? C.tx : C.tx3,
                background: planType === "energy" ? C.s1 : "transparent",
                border: planType === "energy" ? `1px solid ${C.brdL}` : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              Énergétique
            </TabsTrigger>
          </TabsList>

          {/* ── MUSCULATION TAB ─────────────────────────────────────────────── */}
          <TabsContent value="muscu" style={{ outline: "none" }}>
            {/* ── SAISON ────────────────────────────────────────────────────── */}
            {view === "season" && (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <button
                    onClick={() => setShowCompForm(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 10,
                      border: "1px solid " + C.coach + "50",
                      background: C.coachS, color: C.coach,
                      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    🏆 + Compétition
                  </button>
                </div>
                <PlanningOverview athleteId={athleteId} C={C} />
              </>
            )}

            {/* ── FRISE ─────────────────────────────────────────────────────── */}
            {view === "timeline" && (
              <TimelineView athleteId={athleteId} />
            )}

            {/* ── MOIS ──────────────────────────────────────────────────────── */}
            {view === "month" && (
              <CalendarMonthView
                athleteId={athleteId}
                coachId={user?.id ?? ""}
                sessions={sessions}
                blockConfig={blockConfig}
                setBlockConfig={setBlockConfig}
                exos={exos as Record<string, unknown[]>}
                sets={sets as Record<string, unknown[]>}
                completedSessions={completedSessions}
                currentWeek={currentWeek}
                wellnessHistory={wellnessHistory}
                nutritionLog={nutritionLog}
              />
            )}

            {/* ── SYNTHÈSE ──────────────────────────────────────────────────── */}
            {view === "summary" && (
              <SummaryView athleteId={athleteId} />
            )}

            {/* ── COMPÉTITIONS ─────────────────────────────────────────────── */}
            {view === "competitions" && (
              <CompetitionsView athleteId={athleteId} coachId={user?.id ?? ""} />
            )}
          </TabsContent>

          {/* ── ÉNERGÉTIQUE TAB ─────────────────────────────────────────────── */}
          <TabsContent value="energy" style={{ outline: "none" }}>
            <EnergyCalendarView athleteId={athleteId} />
          </TabsContent>
        </Tabs>
      </div>

      {showCompForm && (
        <CompetitionFormModal
          athleteId={athleteId}
          coachId={user?.id ?? ""}
          onClose={() => setShowCompForm(false)}
        />
      )}
    </>
  );
}
