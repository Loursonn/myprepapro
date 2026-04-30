import { useState } from "react";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import TestSessionView from "@/components/TestSessionView";
import { C } from "@/lib/theme";

export default function AthleteTestPage() {
  const { athleteId, viewOnly } = useAthleteContext();
  const [testSubTab, setTestSubTab] = useState("musculation");
  return (
    <TestSessionView
      athleteId={athleteId}
      viewOnly={viewOnly}
      C={C}
      testSubTab={testSubTab}
      setTestSubTab={setTestSubTab}
      isCoach={false}
    />
  );
}
