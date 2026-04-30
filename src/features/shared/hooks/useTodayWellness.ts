import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import type { WellnessData } from "../types/athlete";

/**
 * Today's wellness data from AthleteContext.
 * `null` means the athlete hasn't logged wellness yet today.
 */
export function useTodayWellness(): WellnessData | null {
  const { wellness } = useAthleteContext();
  return wellness;
}
