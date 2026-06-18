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
    let text = `${nb_series} séries × (${cluster.nb_clusters}×${cluster.reps_per_cluster} rep + ${cluster.recup_sec}sec)`
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
