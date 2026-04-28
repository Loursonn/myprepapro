import { useMemo } from "react";
import type { WellnessData } from "../types/athlete";

export interface ReadinessScore {
  score: number;
  color: string;
  label: string;
}

/**
 * Computes the readiness score (0-100) from wellness data using the formula:
 *
 *   readiness = round(
 *     (10 - fatigue)  * 10 * 0.25 +
 *      sommeil        * 10 * 0.25 +
 *     (10 - stress)   * 10 * 0.15 +
 *      energie        * 10 * 0.20 +
 *     (10 - doms)     * 10 * 0.15
 *   )
 *
 * All inputs on a 0-10 scale.
 * Returns null when wellness is not yet logged.
 */
export function useReadinessScore(wellness: WellnessData | null): ReadinessScore | null {
  return useMemo(() => {
    if (!wellness) return null;

    const fatigue = wellness.fatigue ?? 5;
    const sommeil = wellness.sommeil ?? 5;
    const stress  = wellness.stress  ?? 5;
    const energie = wellness.energie ?? 5;
    const doms    = wellness.doms    ?? 5;

    const score = Math.min(100, Math.max(0, Math.round(
      (10 - fatigue) * 10 * 0.25 +
       sommeil        * 10 * 0.25 +
      (10 - stress)  * 10 * 0.15 +
       energie        * 10 * 0.20 +
      (10 - doms)    * 10 * 0.15,
    )));

    let color: string;
    let label: string;
    if (score >= 85) {
      color = "#22C993"; label = "Excellent";
    } else if (score >= 70) {
      color = "#22C993"; label = "Bon";
    } else if (score >= 50) {
      color = "#F5A623"; label = "Moyen";
    } else {
      color = "#EF4B4B"; label = "Faible";
    }

    return { score, color, label };
  }, [wellness]);
}
