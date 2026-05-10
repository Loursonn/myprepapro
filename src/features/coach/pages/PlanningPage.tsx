import { useSearchParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { TimelineView } from "@/features/coach/components/planning/TimelineView";
import { CalendarMonthView } from "@/features/coach/components/planning/CalendarMonthView";
import { SummaryView } from "@/features/coach/components/planning/SummaryView";
import { CompetitionsView } from "@/features/coach/components/planning/CompetitionsView";

type PlanView = "timeline" | "month" | "summary" | "competitions";

export default function PlanningPage() {
  const [searchParams] = useSearchParams();
  const view = (searchParams.get("view") as PlanView) ?? "month";

  const { user } = useAuth();
  const { athleteId, loaded, sessions, blockConfig, setBlockConfig, exos, sets, completedSessions, currentWeek, wellnessHistory, nutritionLog } = useAthleteContext();

  if (!loaded) {
    return (
      <div style={{ padding: "16px 24px" }}>
        <Skeleton style={{ height: 300, borderRadius: 14, background: C.s1 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 24px 60px" }}>
      {view === "timeline" && <TimelineView athleteId={athleteId} />}

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

      {view === "summary" && <SummaryView athleteId={athleteId} />}

      {view === "competitions" && (
        <CompetitionsView athleteId={athleteId} coachId={user?.id ?? ""} />
      )}
    </div>
  );
}
