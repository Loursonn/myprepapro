import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { CoachWeeklyFeedback } from "@/components/coach/CoachComponents";

export default function RetoursPage() {
  const { athleteId, sessions, completedSessions, energySessions, currentWeek, blockConfig, exos, sets, wellnessHistory } = useAthleteContext();
  return (
    <CoachWeeklyFeedback
      athleteId={athleteId}
      sessions={sessions}
      completedSessions={completedSessions}
      energySessions={energySessions}
      currentWeek={currentWeek}
      blockConfig={blockConfig}
      exos={exos}
      sets={sets}
      wellnessHistory={wellnessHistory}
      C={C}
    />
  );
}
