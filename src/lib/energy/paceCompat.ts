import type { EnergyTarget } from "@/types/energy";

export type PaceTarget = Extract<EnergyTarget, { kind: "pace" }>;

/**
 * Bornes d'une cible d'allure, en secondes par km.
 *
 * L'éditeur d'intervalles a longtemps écrit `{ min, max }` alors que le format
 * canonique (et tous les consommateurs) attendent `{ min_s_per_unit,
 * max_s_per_unit }` : les allures saisies ne s'affichaient jamais et les durées
 * estimées tombaient à NaN. On lit donc les deux formes pour rester compatible
 * avec les séances déjà enregistrées.
 */
export function paceBounds(target: PaceTarget): { min: number; max: number } {
  const legacy = target as unknown as { min?: number; max?: number };
  return {
    min: target.min_s_per_unit ?? legacy.min ?? 0,
    max: target.max_s_per_unit ?? legacy.max ?? 0,
  };
}
