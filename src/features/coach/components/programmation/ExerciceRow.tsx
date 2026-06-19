import { useState } from "react"
import { C } from "@/lib/theme"
import { GripVertical, Settings, X, Check } from "lucide-react"
import type { Exercice } from "./types"
import { SyntheseBar } from "./SyntheseBar"
import { ExerciceParamsPanel } from "./ExerciceParamsPanel"
import { RmDrawer } from "./RmDrawer"
import { useExerciceRM } from "./hooks/useExerciceRM"

const VIOLET = "#7B6FFF"
const VIOLET_S = "rgba(123,111,255,0.12)"

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
    return rec[String(activeWeek)] ?? Object.values(rec)[0] ?? null
  }
  return exercice.params as import("./types").ExerciceParams
}

export function ExerciceRow({
  exercice,
  index,
  athleteId,
  sessionMultiSemaine,
  activeWeek,
  blocSeriesMode,
  blocSeriesCount,
  onMoveUp: _onMoveUp,
  onMoveDown: _onMoveDown,
  onDelete,
  onChange,
  dragHandleProps,
}: ExerciceRowProps) {
  const [showParams, setShowParams] = useState(false)
  const [showRm, setShowRm] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const { best: bestRM } = useExerciceRM(athleteId, exercice.exercise_name)

  const effectiveMultiSemaine = sessionMultiSemaine || (exercice.multi_semaine ?? false)
  const displayParams = getDisplayParams(exercice, activeWeek, effectiveMultiSemaine)

  const hasName = !!exercice.exercise_name

  return (
    <div style={{
      borderRadius: 10,
      border: "1px solid " + (showParams ? VIOLET + "50" : C.brdL),
      background: showParams ? VIOLET + "04" : C.s1,
      overflow: "hidden",
      transition: "border-color 150ms, background 150ms",
    }}>
      {/* Row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px" }}>

        {/* Drag */}
        <div
          {...(dragHandleProps ?? {})}
          style={{ cursor: "grab", color: C.tx3 + "70", display: "flex", alignItems: "center", flexShrink: 0 }}
        >
          <GripVertical size={12} />
        </div>

        {/* Index badge */}
        <div style={{
          width: 18, height: 18, borderRadius: 5,
          background: hasName ? VIOLET_S : C.s2,
          color: hasName ? VIOLET : C.tx3,
          fontSize: 9, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {index + 1}
        </div>

        {/* Exercise info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name row */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: hasName ? C.tx : C.tx3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              minWidth: 0, flex: 1,
            }}>
              {exercice.exercise_name || "Exercice non défini"}
            </div>

            {exercice.mode === 'methode' && exercice.methode_id && (
              <div style={{ fontSize: 8, fontWeight: 700, color: VIOLET, background: VIOLET_S, padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>
                méthode
              </div>
            )}

            {/* 1RM — always visible when exercise selected */}
            {hasName && (
              <button
                onClick={() => setShowRm(true)}
                style={{
                  background: bestRM ? VIOLET_S : C.s2,
                  border: "1px solid " + (bestRM ? VIOLET + "40" : C.brdL),
                  color: bestRM ? VIOLET : C.tx3,
                  fontSize: 9, fontWeight: 700,
                  borderRadius: 5, padding: "1px 6px",
                  cursor: "pointer", fontFamily: "inherit",
                  flexShrink: 0, whiteSpace: "nowrap",
                }}
              >
                {bestRM ? `${bestRM.kg}kg 1RM` : "— 1RM"}
              </button>
            )}
          </div>

          {displayParams && (
            <div style={{ marginTop: 2 }}>
              <SyntheseBar params={displayParams} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          <button
            onClick={() => setShowParams(p => !p)}
            style={{
              width: 24, height: 24, borderRadius: 6,
              border: "1px solid " + (showParams ? VIOLET : C.brdL),
              background: showParams ? VIOLET_S : "transparent",
              color: showParams ? VIOLET : C.tx3,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
            title="Paramètres"
          ><Settings size={11} /></button>

          {confirmingDelete ? (
            <>
              <button
                onClick={onDelete}
                style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: C.r, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              ><Check size={11} /></button>
              <button
                onClick={() => setConfirmingDelete(false)}
                style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              ><X size={11} /></button>
            </>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid " + C.r + "40", background: C.rS, color: C.r, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            ><X size={11} /></button>
          )}
        </div>
      </div>

      {/* Params panel */}
      {showParams && (
        <div style={{ borderTop: "1px solid " + VIOLET + "30", padding: "0 10px 12px" }}>
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
