import { useState } from "react";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import TestSessionView from "@/components/TestSessionView";

export default function TestPage() {
  const { athleteId, viewOnly } = useAthleteContext();
  const [testSubTab, setTestSubTab] = useState("musculation");
  return <TestSessionView athleteId={athleteId} viewOnly={viewOnly} C={C} testSubTab={testSubTab} setTestSubTab={setTestSubTab} isCoach={true} />;
}
