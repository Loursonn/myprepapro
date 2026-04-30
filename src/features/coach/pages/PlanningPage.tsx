import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { CompetitionFormModal } from "@/features/coach/components/planning/CompetitionFormModal";

// Vue Saison
import { PlanningOverview } from "@/components/coach/PlanningOverview";

// Vue Frise
import { TimelineView } from "@/features/coach/components/planning/TimelineView";

// Vue Mois
import { CalendarMonthView } from "@/features/coach/components/planning/CalendarMonthView";

// Vue Synthèse
import { SummaryView } from "@/features/coach/components/planning/SummaryView";

// ── View types ────────────────────────────────────────────────────────────────

type PlanView = "season" | "timeline" | "month" | "summary";

// ── PlanningPage ──────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const [searchParams] = useSearchParams();
  const view = (searchParams.get("view") as PlanView) ?? "season";

  const { user } = useAuth();
  const { athleteId, loaded, sessions, blockConfig, setBlockConfig, exos, sets, completedSessions, currentWeek } = useAthleteContext();
  const [showCompForm, setShowCompForm] = useState(false);

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
      {/* ── SAISON ────────────────────────────────────────────────────────── */}
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

      {/* ── FRISE ─────────────────────────────────────────────────────────── */}
      {view === "timeline" && (
        <TimelineView athleteId={athleteId} />
      )}

      {/* ── MOIS ──────────────────────────────────────────────────────────── */}
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
        />
      )}

      {/* ── SYNTHÈSE ──────────────────────────────────────────────────────── */}
      {view === "summary" && (
        <SummaryView athleteId={athleteId} />
      )}
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
