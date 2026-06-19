import { C } from "@/lib/theme"
import type { ExerciceParams, ParamValue } from "./types"

const VIOLET = "#7B6FFF"

interface SyntheseBarProps {
  params: ExerciceParams
}

function getVal<T>(pv: ParamValue<T>): T | undefined {
  return pv.mode === 'global' ? pv.value : undefined
}

function formatCharge(value: number | null, unit: ExerciceParams['charge_unit']): string {
  if (value == null) return '—'
  if (unit === '%RM') return `${value}%`
  if (unit === 'kg') return `${value}kg`
  return String(value)
}

export function SyntheseBar({ params }: SyntheseBarProps) {
  const { nb_series, cluster, reps, reps_mode: _reps_mode, charge_unit, charge, rir, tempo } = params

  // Guard: old/incomplete data missing required fields
  if (!reps || !charge || !rir || !tempo) return null

  if (charge_unit === 'PDC') {
    // PDC — body weight
    const repsVal = getVal(reps)
    const rirVal = getVal(rir)
    const tempoVal = getVal(tempo)
    let text = `${nb_series}×${repsVal ?? '?'} @ PDC`
    if (rirVal != null) text += ` — RIR ${rirVal}`
    if (tempoVal) text += ` — Tempo ${tempoVal}`
    return (
      <div style={{ fontSize: 11, color: VIOLET, fontFamily: "inherit", fontWeight: 600 }}>
        {text}
      </div>
    )
  }

  // Par série mode
  if (reps.mode === 'par_serie' || charge.mode === 'par_serie') {
    const parts: string[] = []
    for (let i = 0; i < nb_series; i++) {
      const r = reps.mode === 'par_serie' ? reps.values[i] : getVal(reps)
      const c = charge.mode === 'par_serie' ? charge.values[i] : getVal(charge)
      let seg = `S${i + 1}: ${r ?? '?'}`
      if (c != null) seg += `×${formatCharge(c, charge_unit)}`
      parts.push(seg)
    }
    const rirVal = rir.mode === 'global' ? getVal(rir) : null
    let text = parts.join(' / ')
    if (rirVal != null) text += ` — RIR ${rirVal}`
    return (
      <div style={{ fontSize: 11, color: VIOLET, fontFamily: "inherit", fontWeight: 600 }}>
        {text}
      </div>
    )
  }

  // Cluster mode
  if (cluster) {
    const chargeVal = getVal(charge)
    const rirVal = getVal(rir)
    // compat: old format had reps_per_cluster (number), new has reps (number[])
    const repsArr: number[] = Array.isArray(cluster.reps)
      ? cluster.reps
      : Array(cluster.nb_clusters).fill((cluster as unknown as { reps_per_cluster?: number }).reps_per_cluster ?? 5)
    const repsStr = repsArr.join("+")
    let text = `${nb_series}×(${repsStr} + ${cluster.recup_sec}s)`
    if (chargeVal != null) text += ` @ ${formatCharge(chargeVal, charge_unit)}`
    if (rirVal != null) text += ` — RIR ${rirVal}`
    return (
      <div style={{ fontSize: 11, color: VIOLET, fontFamily: "inherit", fontWeight: 600 }}>
        {text}
      </div>
    )
  }

  // Global mode
  const repsVal = getVal(reps)
  const chargeVal = getVal(charge)
  const rirVal = getVal(rir)
  const tempoVal = getVal(tempo)

  let text = `${nb_series}×${repsVal ?? '?'}`
  if (chargeVal != null) text += ` @ ${formatCharge(chargeVal, charge_unit)}`
  if (rirVal != null) text += ` — RIR ${rirVal}`
  if (tempoVal) text += ` — Tempo ${tempoVal}`

  return (
    <div style={{ fontSize: 11, color: VIOLET, fontFamily: "inherit", fontWeight: 600 }}>
      {text || <span style={{ color: C.tx3 }}>Aucun paramètre défini</span>}
    </div>
  )
}
