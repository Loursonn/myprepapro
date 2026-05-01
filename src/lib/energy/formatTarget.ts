import type { EnergyTarget } from "@/types/energy";

/** Formate un EnergyTarget en string lisible en français. */
export function formatTarget(target: EnergyTarget): string {
  switch (target.kind) {
    case "none":
      return "Libre";
    case "hr_zone":
      return `Zone ${target.zone}`;
    case "hr_pct":
      return `${target.min}–${target.max}% FCmax`;
    case "hr_bpm":
      return `${target.min}–${target.max} bpm`;
    case "pace":
      if (target.unit === "min_per_km") {
        return `${_fmtPace(target.min)}–${_fmtPace(target.max)}/km`;
      }
      return `${target.min}–${target.max} km/h`;
    case "pace_test_pct":
      return `${target.min}–${target.max}% ${target.test_metric}`;
    case "power":
      return `${target.min}–${target.max} W`;
    case "power_test_pct":
      return `${target.min}–${target.max}% ${target.test_metric}`;
    case "cadence":
      return `${target.min}–${target.max} ${target.unit}`;
    case "x_per_y": {
      const xLabel = { time: "s", cal: "kcal", watt: "W" }[target.x_kind];
      const yLabel = { time: "s", distance: "m" }[target.y_kind];
      return `${target.x_value} ${xLabel} / ${target.y_value} ${yLabel}`;
    }
    case "text":
      return target.value;
    default:
      return "";
  }
}

/** Formate un nombre de minutes décimales en "M'SS" (ex: 5.25 → "5'15") */
function _fmtPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}'${String(secs).padStart(2, "0")}`;
}

/** Formate des secondes en MM:SS */
export function formatS(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.round(totalSecs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Formate des secondes en HH:MM:SS */
export function formatSLong(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.round(totalSecs % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
