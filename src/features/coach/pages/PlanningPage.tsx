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

const VIEWS: { key: PlanView; label: string }[] = [
  { key: "season",   label: "Saison"   },
  { key: "timeline", label: "Frise"    },
  { key: "month",    label: "Mois"     },
  { key: "summary",  label: "Synthèse" },
];

// ── PlanningPage ──────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get("view") as PlanView) ?? "season";

  const { user } = useAuth();
  const { athleteId, loaded, sessions } = useAthleteContext();

  function setView(v: PlanView) {
    setSearchParams({ view: v });
  }

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
      {/* View selector */}
      <div
        style={{
          display: "inline-flex", background: C.s1, borderRadius: 10,
          padding: 3, border: "1px solid " + C.brdL, marginBottom: 20, gap: 2,
        }}
      >
        {VIEWS.map((v) => {
          const active = view === v.key;
          return (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              style={{
                padding: "6px 16px", borderRadius: 8, border: "none",
                background: active ? C.ac : "transparent",
                color: active ? "#fff" : C.tx3,
                fontSize: 12, fontWeight: active ? 600 : 400,
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 150ms",
              }}
            >
              {v.label}
            </button>
          );
        })}
      </div>

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
