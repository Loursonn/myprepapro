import { useState } from "react"
import { C } from "@/lib/theme"
import { GripVertical, ChevronUp, ChevronDown, Settings, X, Check } from "lucide-react"
import type { Exercice } from "./types"
import { SyntheseBar } from "./SyntheseBar"
import { ExerciceParamsPanel } from "./ExerciceParamsPanel"
import { RmDrawer } from "./RmDrawer"
import { useExerciceRM } from "./hooks/useExerciceRM"

const VIOLET = "#7B6FFF"

interface ExerciceRowProps {
  exercice: Exercice
  index: number
  total: number
  athleteId: string | undefined
  sessionMultiSemaine: boolean
  activeWeek: number
  blocSeriesMode: 'libre' | 'fixe'
  blocSeriesCount?: number
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onChange: (updated: Exercice) => void
  dragHandleProps?: Record<string, unknown>
}

function getDisplayParams(exercice: Exercice, activeWeek: number, multiSemaine: boolean) {
  if (!multiSemaine) return exercice.params as import("./types").ExerciceParams
  if (typeof exercice.params === 'object' && !('mode' in exercice.params)) {
    const rec = exercice.params as Record<string, import("./types").ExerciceParams>
    const weekKey = String(activeWeek)
    return rec[weekKey] ?? Object.values(rec)[0] ?? null
  }
  return exercice.params as import("./types").ExerciceParams
}

export function ExerciceRow({
  exercice,
  index,
  total,
  athleteId,
  sessionMultiSemaine,
  activeWeek,
  blocSeriesMode,
  blocSeriesCount,
  onMoveUp,
  onMoveDown,
  onDelete,
  onChange,
  dragHandleProps,
}: ExerciceRowProps) {
  const [showParams, setShowParams] = useState(false)
  const [showRm, setShowRm] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const { best: bestRM } = useExerciceRM(athleteId, exercice.exercise_name)

  // Effective multi_semaine: session level OR per-exercise override
  const effectiveMultiSemaine = sessionMultiSemaine || (exercice.multi_semaine ?? false)
  const displayParams = getDisplayParams(exercice, activeWeek, effectiveMultiSemaine)

  return (
    <div style={{ background: C.s2, borderRadius: 10, border: "1px solid " + C.brdL, overflow: "hidden" }}>
      {/* Row header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
        {/* Drag handle */}
        <div
          {...(dragHandleProps ?? {})}
          style={{ cursor: "grab", color: C.tx3, display: "flex", alignItems: "center", flexShrink: 0 }}
        >
          <GripVertical size={14} />
        </div>

        {/* Up/down */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            style={{ background: "transparent", border: "none", color: index === 0 ? C.tx3 + "40" : C.tx3, cursor: index === 0 ? "default" : "pointer", padding: 2, display: "flex" }}
          ><ChevronUp size={11} /></button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            style={{ background: "transparent", border: "none", color: index === total - 1 ? C.tx3 + "40" : C.tx3, cursor: index === total - 1 ? "default" : "pointer", padding: 2, display: "flex" }}
          ><ChevronDown size={11} /></button>
        </div>

        {/* Exercise info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {exercice.exercise_name || <span style={{ color: C.tx3 }}>Exercice non défini</span>}
          </div>
          {/* RM display */}
          <div style={{ fontSize: 11, marginTop: 2 }}>
            {bestRM ? (
              <span style={{ color: VIOLET, fontWeight: 700 }}>{bestRM.kg} kg — 1RM</span>
            ) : exercice.exercise_name ? (
              <button
                onClick={() => setShowRm(true)}
                style={{ background: "transparent", border: "none", color: C.tx3, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0, textDecoration: "underline" }}
              >
                — Ajouter 1RM
              </button>
            ) : null}
          </div>
          {/* Synthese */}
          {displayParams && (
            <div style={{ marginTop: 4 }}>
              <SyntheseBar params={displayParams} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => setShowParams(p => !p)}
            style={{
              width: 28, height: 28, borderRadius: 7,
              border: "1px solid " + (showParams ? VIOLET : C.brdL),
              background: showParams ? VIOLET + "20" : "transparent",
              color: showParams ? VIOLET : C.tx3,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          ><Settings size={13} /></button>

          {confirmingDelete ? (
            <>
              <button
                onClick={onDelete}
                style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: C.r, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              ><Check size={13} /></button>
              <button
                onClick={() => setConfirmingDelete(false)}
                style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              ><X size={13} /></button>
            </>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid " + C.r + "40", background: C.rS, color: C.r, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            ><X size={13} /></button>
          )}
        </div>
      </div>

      {/* Inline params */}
      {showParams && (
        <div style={{ borderTop: "1px solid " + C.brdL, padding: "0 12px 12px" }}>
          <ExerciceParamsPanel
            exercice={exercice}
            blocSeriesMode={blocSeriesMode}
            blocSeriesCount={blocSeriesCount}
            sessionMultiSemaine={sessionMultiSemaine}
            activeWeek={activeWeek}
            athleteId={athleteId}
            onChange={onChange}
          />
        </div>
      )}

      {/* RM Drawer */}
      {showRm && (
        <RmDrawer
          open={showRm}
          onClose={() => setShowRm(false)}
          exerciseName={exercice.exercise_name}
          athleteId={athleteId}
        />
      )}
    </div>
  )
}
