import { useState } from "react"
import { C } from "@/lib/theme"
import type { Exercice, ExerciceParams, ClusterConfig, ParamValue } from "./types"
import { defaultExerciceParams } from "./types"
import { ExerciceSearch } from "./ExerciceSearch"
import { ParamSeriesGrid } from "./ParamSeriesGrid"
import { SyntheseBar } from "./SyntheseBar"
import { useTrainingMethods } from "@/features/shared/hooks/useTrainingMethods"
import { useExerciceRM } from "./hooks/useExerciceRM"
import type { TrainingMethod } from "@/types/trainingMethods"

const VIOLET = "#7B6FFF"
const VIOLET_S = "rgba(123,111,255,0.12)"
const ORANGE = "#F5A623"

interface ExerciceParamsProps {
  exercice: Exercice
  blocSeriesMode: 'libre' | 'fixe'
  blocSeriesCount?: number
  sessionMultiSemaine: boolean
  activeWeek: number
  athleteId: string | undefined
  onChange: (updated: Exercice) => void
}

function pill(active: boolean, color = VIOLET): React.CSSProperties {
  return {
    padding: "5px 10px", borderRadius: 6,
    border: "1px solid " + (active ? color : C.brdL),
    background: active ? color + "20" : "transparent",
    color: active ? color : C.tx3,
    fontSize: 11, fontWeight: active ? 700 : 500,
    cursor: "pointer", fontFamily: "inherit", transition: "all 100ms",
  }
}

function getParams(exercice: Exercice, activeWeek: number, multiSemaine: boolean): ExerciceParams {
  if (!multiSemaine || typeof exercice.params !== 'object' || !('mode' in exercice.params)) {
    // Check if it's a week-keyed Record
    if (multiSemaine && typeof exercice.params === 'object') {
      const weekKey = String(activeWeek)
      const rec = exercice.params as Record<string, ExerciceParams>
      return rec[weekKey] ?? defaultExerciceParams()
    }
    return exercice.params as ExerciceParams
  }
  return exercice.params as ExerciceParams
}

function setParams(exercice: Exercice, params: ExerciceParams, activeWeek: number, multiSemaine: boolean): Exercice {
  if (multiSemaine) {
    const weekKey = String(activeWeek)
    const rec = (typeof exercice.params === 'object' && !('mode' in exercice.params))
      ? { ...(exercice.params as Record<string, ExerciceParams>) }
      : {}
    rec[weekKey] = params
    return { ...exercice, params: rec }
  }
  return { ...exercice, params }
}

function ensureLength<T>(arr: T[], length: number, fill: T): T[] {
  const result = [...arr]
  while (result.length < length) result.push(fill)
  return result.slice(0, length)
}

const RIR_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5]

function methodToParams(method: TrainingMethod, currentParams: ExerciceParams): ExerciceParams {
  const config = method.config
  const nb_series = currentParams.nb_series

  if (config.scope === 'classic') {
    const cl = config as import("@/types/trainingMethods").ClassicMethodConfig
    const sets = cl.sets?.count ?? nb_series
    const repsVal = cl.reps?.type === 'fixed' ? (cl.reps.value ?? 8)
      : cl.reps?.type === 'range' ? Math.round(((cl.reps.min ?? 8) + (cl.reps.max ?? 12)) / 2) : 8

    return {
      ...currentParams,
      nb_series: sets,
      reps: { mode: 'global', value: repsVal },
    }
  }

  if (config.scope === 'exercise') {
    const ex = config as import("@/types/trainingMethods").ExerciseMethodConfig
    const sets = ex.sets?.count ?? nb_series
    const repsType = ex.reps?.type
    const repsPattern = ex.reps?.pattern
    const repsValue = ex.reps?.value ?? 8

    let reps: ParamValue<number>
    if (repsType === 'custom' && repsPattern) {
      reps = { mode: 'par_serie', values: ensureLength(repsPattern, sets, repsValue) }
    } else {
      reps = { mode: 'global', value: repsValue }
    }

    let charge: ParamValue<number | null> = { mode: 'global', value: null }
    if (ex.load?.type === 'custom' && ex.load.values) {
      const vals = ex.load.values.map(v => v || null) as (number | null)[]
      charge = { mode: 'par_serie', values: ensureLength(vals, sets, null) }
    } else if (ex.load?.pct_of_1rm) {
      charge = { mode: 'global', value: ex.load.pct_of_1rm }
    }

    return {
      ...currentParams,
      nb_series: sets,
      reps,
      charge,
      charge_unit: ex.load?.mode === 'pct_1rm' ? '%RM' : currentParams.charge_unit,
    }
  }

  if (config.scope === 'set') {
    const s = config as import("@/types/trainingMethods").SetMethodConfig
    const subCount = s.sub_sets?.count?.value ?? s.sub_sets?.count?.min ?? 3
    const subReps = s.sub_sets?.reps?.value ?? 5
    const restSec = s.sub_sets?.rest_intra?.seconds ?? 15

    return {
      ...currentParams,
      cluster: { nb_clusters: subCount, reps_per_cluster: subReps, recup_sec: restSec },
    }
  }

  return currentParams
}

export function ExerciceParamsPanel({
  exercice,
  blocSeriesMode,
  blocSeriesCount,
  sessionMultiSemaine,
  activeWeek,
  athleteId,
  onChange,
}: ExerciceParamsProps) {
  const [showSearch, setShowSearch] = useState(!exercice.exercise_name)
  const { data: methods = [] } = useTrainingMethods()
  const { best: bestRM } = useExerciceRM(athleteId, exercice.exercise_name)

  // Effective multi_semaine: session level OR per-exercise override
  const multiSemaine = sessionMultiSemaine || (exercice.multi_semaine ?? false)

  const params = getParams(exercice, activeWeek, multiSemaine)

  function updateParams(partial: Partial<ExerciceParams>) {
    const updated = { ...params, ...partial }
    onChange(setParams(exercice, updated, activeWeek, multiSemaine))
  }

  function updateMode(mode: 'classique' | 'methode') {
    onChange({ ...exercice, mode, methode_id: undefined })
  }

  function handleMethodSelect(method: TrainingMethod) {
    const converted = methodToParams(method, params)
    onChange(setParams({ ...exercice, methode_id: method.id, mode: 'methode' }, converted, activeWeek, multiSemaine))
  }

  const nb = blocSeriesMode === 'fixe' && blocSeriesCount ? blocSeriesCount : params.nb_series

  // Reps par série helpers
  const repsGlobal = params.reps.mode === 'global' ? params.reps.value : 8
  const repsValues = params.reps.mode === 'par_serie'
    ? ensureLength(params.reps.values, nb, repsGlobal)
    : Array(nb).fill(repsGlobal)

  const chargeGlobal = params.charge.mode === 'global' ? params.charge.value : null
  const chargeValues = params.charge.mode === 'par_serie'
    ? ensureLength(params.charge.values, nb, chargeGlobal)
    : Array(nb).fill(chargeGlobal)

  const rirGlobal = params.rir.mode === 'global' ? params.rir.value : 2
  const rirValues = params.rir.mode === 'par_serie'
    ? ensureLength(params.rir.values, nb, rirGlobal)
    : Array(nb).fill(rirGlobal)

  const tempoGlobal = params.tempo.mode === 'global' ? params.tempo.value : ''
  const tempoValues = params.tempo.mode === 'par_serie'
    ? ensureLength(params.tempo.values, nb, tempoGlobal)
    : Array(nb).fill(tempoGlobal)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 0" }}>

      {/* 1. Exercise selection */}
      <div>
        <label style={{ fontSize: 11, color: C.tx3, display: "block", marginBottom: 6, fontWeight: 600 }}>Exercice</label>
        {showSearch ? (
          <ExerciceSearch
            value={exercice.exercise_name}
            onSelect={ex => {
              onChange({ ...exercice, exercise_id: ex.id, exercise_name: ex.name })
              setShowSearch(false)
            }}
            onClose={() => setShowSearch(false)}
          />
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 8,
              border: "1px solid " + C.brdL, background: C.s2,
              color: exercice.exercise_name ? C.tx : C.tx3,
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            {exercice.exercise_name || "Choisir un exercice…"}
          </button>
        )}
      </div>

      {/* 2. Mode */}
      <div>
        <label style={{ fontSize: 11, color: C.tx3, display: "block", marginBottom: 6, fontWeight: 600 }}>Mode</label>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => updateMode('classique')} style={pill(exercice.mode === 'classique')}>Classique</button>
          <button onClick={() => updateMode('methode')} style={pill(exercice.mode === 'methode')}>Méthode</button>
        </div>
      </div>

      {/* 3. Method dropdown */}
      {exercice.mode === 'methode' && (
        <div>
          <label style={{ fontSize: 11, color: C.tx3, display: "block", marginBottom: 6, fontWeight: 600 }}>Méthode</label>
          <select
            value={exercice.methode_id ?? ""}
            onChange={e => {
              const m = methods.find(x => x.id === e.target.value)
              if (m) handleMethodSelect(m)
            }}
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 8,
              border: "1px solid " + C.brdL, background: C.s2, color: C.tx,
              fontSize: 13, fontFamily: "inherit", outline: "none",
            }}
          >
            <option value="">Choisir une méthode…</option>
            {methods.map(m => (
              <option key={m.id} value={m.id}>{m.name} — {m.category}</option>
            ))}
          </select>
        </div>
      )}

      {/* 4. Séries + Cluster */}
      <div>
        <label style={{ fontSize: 11, color: C.tx3, display: "block", marginBottom: 6, fontWeight: 600 }}>Séries</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {blocSeriesMode === 'libre' && (
            <input
              type="number"
              value={params.nb_series}
              onChange={e => updateParams({ nb_series: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              min={1} max={20}
              style={{ width: 56, padding: "7px 8px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none", textAlign: "center" }}
            />
          )}
          {blocSeriesMode === 'fixe' && (
            <span style={{ fontSize: 13, color: C.tx2, fontWeight: 700 }}>{blocSeriesCount} séries (fixe)</span>
          )}
          <button
            onClick={() => {
              if (params.cluster) {
                updateParams({ cluster: undefined })
              } else {
                updateParams({ cluster: { nb_clusters: 3, reps_per_cluster: 5, recup_sec: 15 } })
              }
            }}
            style={pill(!!params.cluster, ORANGE)}
          >
            {params.cluster ? "Cluster ON" : "Cluster"}
          </button>
        </div>
        {params.cluster && (
          <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, border: "1px solid " + ORANGE + "40", background: ORANGE + "10", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="number"
                value={params.cluster.nb_clusters}
                onChange={e => updateParams({ cluster: { ...params.cluster!, nb_clusters: Math.max(1, parseInt(e.target.value, 10) || 1) } })}
                min={1} max={10}
                style={{ width: 40, padding: "4px 6px", borderRadius: 5, border: "1px solid " + C.brdL, background: C.s2, color: ORANGE, fontSize: 12, fontFamily: "inherit", outline: "none", textAlign: "center" }}
              />
              <span style={{ fontSize: 11, color: ORANGE }}>clusters</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, color: ORANGE }}>×</span>
              <input
                type="number"
                value={params.cluster.reps_per_cluster}
                onChange={e => updateParams({ cluster: { ...params.cluster!, reps_per_cluster: Math.max(1, parseInt(e.target.value, 10) || 1) } })}
                min={1} max={20}
                style={{ width: 40, padding: "4px 6px", borderRadius: 5, border: "1px solid " + C.brdL, background: C.s2, color: ORANGE, fontSize: 12, fontFamily: "inherit", outline: "none", textAlign: "center" }}
              />
              <span style={{ fontSize: 11, color: ORANGE }}>rep</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, color: ORANGE }}>+</span>
              <input
                type="number"
                value={params.cluster.recup_sec}
                onChange={e => updateParams({ cluster: { ...params.cluster!, recup_sec: Math.max(0, parseInt(e.target.value, 10) || 0) } })}
                min={0} max={300}
                style={{ width: 40, padding: "4px 6px", borderRadius: 5, border: "1px solid " + C.brdL, background: C.s2, color: ORANGE, fontSize: 12, fontFamily: "inherit", outline: "none", textAlign: "center" }}
              />
              <span style={{ fontSize: 11, color: ORANGE }}>sec récup</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Reps */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={{ fontSize: 11, color: C.tx3, fontWeight: 600 }}>Répétitions</label>
          <button
            onClick={() => {
              if (params.reps.mode === 'par_serie') {
                updateParams({ reps: { mode: 'global', value: repsValues[0] ?? 8 } })
              } else {
                updateParams({ reps: { mode: 'par_serie', values: Array(nb).fill(repsGlobal) } })
              }
            }}
            style={{ fontSize: 10, color: params.reps.mode === 'par_serie' ? VIOLET : C.tx3, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            {params.reps.mode === 'par_serie' ? "↩ Global" : "Par série"}
          </button>
        </div>
        {params.reps.mode === 'global' ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="number"
              value={repsGlobal}
              onChange={e => updateParams({ reps: { mode: 'global', value: Math.max(1, parseInt(e.target.value, 10) || 1) } })}
              min={1} max={100}
              style={{ width: 60, padding: "7px 8px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none", textAlign: "center" }}
            />
            <button
              onClick={() => updateParams({ reps_mode: { mode: 'global', value: 'EC' } })}
              style={pill((params.reps_mode.mode === 'global' ? params.reps_mode.value : 'EC') === 'EC')}
            >EC</button>
            <button
              onClick={() => updateParams({ reps_mode: { mode: 'global', value: 'iso' } })}
              style={pill((params.reps_mode.mode === 'global' ? params.reps_mode.value : 'EC') === 'iso')}
            >ISO</button>
          </div>
        ) : (
          <ParamSeriesGrid
            nb_series={nb}
            values={repsValues}
            onChange={values => updateParams({ reps: { mode: 'par_serie', values } })}
            renderCell={(v, _i, ch) => (
              <input
                type="number"
                value={v}
                onChange={e => ch(Math.max(1, parseInt(e.target.value, 10) || 1))}
                min={1} max={100}
                style={{ width: "100%", padding: "5px 4px", borderRadius: 6, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", textAlign: "center", boxSizing: "border-box" }}
              />
            )}
          />
        )}
      </div>

      {/* 6. Charge */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={{ fontSize: 11, color: C.tx3, fontWeight: 600 }}>Charge</label>
          <button
            onClick={() => {
              if (params.charge.mode === 'par_serie') {
                updateParams({ charge: { mode: 'global', value: chargeValues[0] } })
              } else {
                updateParams({ charge: { mode: 'par_serie', values: Array(nb).fill(chargeGlobal) } })
              }
            }}
            style={{ fontSize: 10, color: params.charge.mode === 'par_serie' ? VIOLET : C.tx3, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            {params.charge.mode === 'par_serie' ? "↩ Global" : "Par série"}
          </button>
        </div>

        {/* Unit pills */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {(['%RM', 'kg', 'PDC'] as const).map(u => (
            <button
              key={u}
              onClick={() => updateParams({ charge_unit: u })}
              style={pill(params.charge_unit === u)}
            >{u}</button>
          ))}
        </div>

        {/* RM warning */}
        {params.charge_unit === '%RM' && !bestRM && (
          <div style={{
            padding: "8px 10px", borderRadius: 8, marginBottom: 8,
            background: C.oS, border: "1px solid " + C.o + "40",
            fontSize: 11, color: C.o,
          }}>
            Aucun 1RM enregistré — la valeur en % s'affichera telle quelle
          </div>
        )}

        {params.charge_unit !== 'PDC' && (
          params.charge.mode === 'global' ? (
            <input
              type="number"
              value={chargeGlobal ?? ""}
              onChange={e => updateParams({ charge: { mode: 'global', value: e.target.value === "" ? null : parseFloat(e.target.value) } })}
              placeholder="—"
              min={0}
              style={{ width: 80, padding: "7px 8px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none", textAlign: "center" }}
            />
          ) : (
            <ParamSeriesGrid
              nb_series={nb}
              values={chargeValues}
              onChange={values => updateParams({ charge: { mode: 'par_serie', values } })}
              renderCell={(v, _i, ch) => (
                <input
                  type="number"
                  value={v ?? ""}
                  onChange={e => ch(e.target.value === "" ? null : parseFloat(e.target.value))}
                  placeholder="—"
                  style={{ width: "100%", padding: "5px 4px", borderRadius: 6, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 12, fontFamily: "inherit", outline: "none", textAlign: "center", boxSizing: "border-box" }}
                />
              )}
            />
          )
        )}
      </div>

      {/* 7. RIR */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={{ fontSize: 11, color: C.tx3, fontWeight: 600 }}>RIR</label>
          <button
            onClick={() => {
              if (params.rir.mode === 'par_serie') {
                updateParams({ rir: { mode: 'global', value: rirValues[0] ?? 2 } })
              } else {
                updateParams({ rir: { mode: 'par_serie', values: Array(nb).fill(rirGlobal) } })
              }
            }}
            style={{ fontSize: 10, color: params.rir.mode === 'par_serie' ? VIOLET : C.tx3, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            {params.rir.mode === 'par_serie' ? "↩ Global" : "Par série"}
          </button>
        </div>
        {params.rir.mode === 'global' ? (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {RIR_OPTIONS.map(r => (
              <button
                key={r}
                onClick={() => updateParams({ rir: { mode: 'global', value: r } })}
                style={pill(rirGlobal === r)}
              >{r}</button>
            ))}
          </div>
        ) : (
          <ParamSeriesGrid
            nb_series={nb}
            values={rirValues}
            onChange={values => updateParams({ rir: { mode: 'par_serie', values } })}
            renderCell={(v, _i, ch) => (
              <select
                value={v}
                onChange={e => ch(parseFloat(e.target.value))}
                style={{ width: "100%", padding: "5px 4px", borderRadius: 6, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 11, fontFamily: "inherit", outline: "none" }}
              >
                {RIR_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
          />
        )}
      </div>

      {/* 8. Tempo */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={{ fontSize: 11, color: C.tx3, fontWeight: 600 }}>
            Tempo <span style={{ fontWeight: 400, fontSize: 10 }}>ecc–pause–con–haut</span>
          </label>
          <button
            onClick={() => {
              if (params.tempo.mode === 'par_serie') {
                updateParams({ tempo: { mode: 'global', value: tempoValues[0] ?? '' } })
              } else {
                updateParams({ tempo: { mode: 'par_serie', values: Array(nb).fill(tempoGlobal) } })
              }
            }}
            style={{ fontSize: 10, color: params.tempo.mode === 'par_serie' ? VIOLET : C.tx3, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            {params.tempo.mode === 'par_serie' ? "↩ Global" : "Par série"}
          </button>
        </div>
        {params.tempo.mode === 'global' ? (
          <input
            type="text"
            value={tempoGlobal}
            onChange={e => updateParams({ tempo: { mode: 'global', value: e.target.value } })}
            placeholder="3-1-2-0"
            style={{ width: 100, padding: "7px 8px", borderRadius: 7, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 13, fontFamily: "inherit", outline: "none" }}
          />
        ) : (
          <ParamSeriesGrid
            nb_series={nb}
            values={tempoValues}
            onChange={values => updateParams({ tempo: { mode: 'par_serie', values } })}
            renderCell={(v, _i, ch) => (
              <input
                type="text"
                value={v}
                onChange={e => ch(e.target.value)}
                placeholder="3-1-2-0"
                style={{ width: "100%", padding: "5px 4px", borderRadius: 6, border: "1px solid " + C.brdL, background: C.s2, color: C.tx, fontSize: 11, fontFamily: "inherit", outline: "none", textAlign: "center", boxSizing: "border-box" }}
              />
            )}
          />
        )}
      </div>

      {/* 9. Paramètres par semaine (per-exercise override, only when session doesn't have multi_semaine) */}
      {!sessionMultiSemaine && (
        <div>
          <button
            onClick={() => {
              const newMultiSemaine = !(exercice.multi_semaine ?? false)
              // When toggling on, convert current params to week-keyed record
              let newParams = exercice.params
              if (newMultiSemaine && typeof exercice.params === 'object' && 'mode' in exercice.params) {
                // params is currently a flat ExerciceParams, wrap into week 1
                newParams = { '1': exercice.params as ExerciceParams }
              } else if (!newMultiSemaine && typeof exercice.params === 'object' && !('mode' in exercice.params)) {
                // params is currently week-keyed, flatten to first week
                const rec = exercice.params as Record<string, ExerciceParams>
                newParams = Object.values(rec)[0] ?? defaultExerciceParams()
              }
              onChange({ ...exercice, multi_semaine: newMultiSemaine, params: newParams })
            }}
            style={{
              padding: "5px 12px", borderRadius: 6,
              border: "1px solid " + ((exercice.multi_semaine ?? false) ? VIOLET : C.brdL),
              background: (exercice.multi_semaine ?? false) ? VIOLET_S : "transparent",
              color: (exercice.multi_semaine ?? false) ? VIOLET : C.tx3,
              fontSize: 11, fontWeight: (exercice.multi_semaine ?? false) ? 700 : 500,
              cursor: "pointer", fontFamily: "inherit", transition: "all 100ms",
            }}
          >
            {(exercice.multi_semaine ?? false) ? "◉ Paramètres par semaine" : "◎ Paramètres par semaine"}
          </button>
        </div>
      )}

      {/* 10. Synthèse */}
      <div style={{ borderTop: "1px solid " + C.brd, paddingTop: 10 }}>
        <SyntheseBar params={params} />
      </div>
    </div>
  )
}
