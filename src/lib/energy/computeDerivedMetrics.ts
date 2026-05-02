/**
 * computeDerivedMetrics — fonctions pures de dérivation distance/durée/vitesse.
 * Aucune dépendance React / Supabase.
 */

/** Dérive la distance en mètres depuis une durée (s) et une allure (s/km). */
export function deriveDistance(duration_s: number, pace_s_per_km: number): number {
  if (pace_s_per_km <= 0) return 0;
  return Math.round((duration_s / pace_s_per_km) * 1000);
}

/** Dérive la durée en secondes depuis une distance (m) et une allure (s/km). */
export function deriveDuration(distance_m: number, pace_s_per_km: number): number {
  if (pace_s_per_km <= 0) return 0;
  return Math.round((distance_m / 1000) * pace_s_per_km);
}

/** Convertit une allure (s/km) en vitesse (km/h). */
export function deriveSpeed(pace_s_per_km: number): number {
  if (pace_s_per_km <= 0) return 0;
  return Math.round((3600 / pace_s_per_km) * 10) / 10;
}
