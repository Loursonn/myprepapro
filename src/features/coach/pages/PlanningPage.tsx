import { useSearchParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { athleteId, loaded, sessions } = useAthleteContext();

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (!loaded) {
    return (
      <div style={{ padding: "16px 24px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {VIEWS.map((v) => (
            <Skeleton key={v.key} style={{ height: 32, width: 80, borderRadius: 8, background: C.s1 }} />
          ))}
        </div>
        <Skeleton style={{ height: 300, borderRadius: 14, background: C.s1 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 24px 60px" }}>
      {/* ── SAISON ────────────────────────────────────────────────────────── */}
      {view === "season" && (
        <PlanningOverview athleteId={athleteId} C={C} />
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
        />
      )}

      {/* ── SYNTHÈSE ──────────────────────────────────────────────────────── */}
      {view === "summary" && (
        <SummaryView athleteId={athleteId} />
      )}
    </div>
  );
}
