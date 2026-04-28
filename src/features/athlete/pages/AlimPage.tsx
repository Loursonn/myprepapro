import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import NutritionView from "@/components/athlete/NutritionView";

export default function AlimPage() {
  const { athleteId, viewOnly, athleteProfile, nutritionStrategy, setNutritionLog } = useAthleteContext();
  const bmr = (athleteProfile as { base_metabolism?: number } | null)?.base_metabolism ?? null;

  return (
    <NutritionView
      athleteId={athleteId}
      bmr={bmr}
      nutritionStrategy={nutritionStrategy}
      viewOnly={viewOnly}
      onLogSaved={(date, log) => setNutritionLog(prev => ({ ...prev, [date]: log }))}
    />
  );
}
