import { useState } from "react"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { C } from "@/lib/theme"
import { Settings, X, Plus, GripVertical } from "lucide-react"
import type { Bloc, Exercice } from "./types"
import { defaultExerciceParams } from "./types"
import { BlocForm } from "./BlocForm"
import { ExerciceRow } from "./ExerciceRow"

const VIOLET = "#7B6FFF"
const VIOLET_S = "rgba(123,111,255,0.12)"

interface BlocCardProps {
  bloc: Bloc
  index: number
  athleteId: string | undefined
  activeWeek: number          // passed from SessionBlocEditor
  sessionMultiSemaine: boolean // whether the parent session has multi_semaine
  onChange: (updated: Bloc) => void
  onDelete: () => void
  dragHandleProps?: Record<string, unknown>
}

interface SortableExerciceProps {
  exercice: Exercice
  index: number
  total: number
  bloc: Bloc
  athleteId: string | undefined
  activeWeek: number
  sessionMultiSemaine: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onChange: (updated: Exercice) => void
}

function SortableExercice({ exercice, index, total, bloc, athleteId, activeWeek, sessionMultiSemaine, onMoveUp, onMoveDown, onDelete, onChange }: SortableExerciceProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exercice.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
    >
      <ExerciceRow
        exercice={exercice}
        index={index}
        total={total}
        athleteId={athleteId}
        sessionMultiSemaine={sessionMultiSemaine}
        activeWeek={activeWeek}
        blocSeriesMode={bloc.series_mode}
        blocSeriesCount={bloc.series_count}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDelete={onDelete}
        onChange={onChange}
        dragHandleProps={listeners as Record<string, unknown>}
      />
    </div>
  )
}

function timingLabel(bloc: Bloc): string {
  if (bloc.timing_mode === 'libre') return 'Repos libre'
  if (bloc.timing_mode === 'depart') return `Départ /${bloc.timing_depart_min ?? '?'}min`
  const min = bloc.timing_repos_min ?? 0
  const sec = bloc.timing_repos_sec ?? 0
  if (min > 0 && sec > 0) return `Repos ${min}min ${sec}sec`
  if (min > 0) return `Repos ${min}min`
  if (sec > 0) return `Repos ${sec}sec`
  return `Repos —`
}

export function BlocCard({ bloc, index, athleteId, activeWeek, sessionMultiSemaine, onChange, onDelete, dragHandleProps }: BlocCardProps) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(bloc.name)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleExerciceDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const exos = [...bloc.exercices]
    const from = exos.findIndex(e => e.id === active.id)
    const to = exos.findIndex(e => e.id === over.id)
    if (from === -1 || to === -1) return
    exos.splice(to, 0, exos.splice(from, 1)[0])
    onChange({ ...bloc, exercices: exos.map((e, i) => ({ ...e, sort_order: i })) })
  }

  function moveExercice(idx: number, dir: -1 | 1) {
    const exos = [...bloc.exercices]
    const target = idx + dir
    if (target < 0 || target >= exos.length) return
    ;[exos[idx], exos[target]] = [exos[target], exos[idx]]
    onChange({ ...bloc, exercices: exos.map((e, i) => ({ ...e, sort_order: i })) })
  }

  function addExercice() {
    const effectiveMultiSemaine = sessionMultiSemaine
    const newEx: Exercice = {
      id: crypto.randomUUID(),
      exercise_id: "",
      exercise_name: "",
      mode: 'classique',
      sort_order: bloc.exercices.length,
      params: effectiveMultiSemaine
        ? { [String(activeWeek)]: defaultExerciceParams(bloc.series_count ?? 4) }
        : defaultExerciceParams(bloc.series_count ?? 4),
    }
    onChange({ ...bloc, exercices: [...bloc.exercices, newEx] })
  }

  function updateExercice(idx: number, updated: Exercice) {
    const exos = [...bloc.exercices]
    exos[idx] = updated
    onChange({ ...bloc, exercices: exos })
  }

  function deleteExercice(idx: number) {
    const exos = bloc.exercices.filter((_, i) => i !== idx)
    onChange({ ...bloc, exercices: exos.map((e, i) => ({ ...e, sort_order: i })) })
  }

  return (
    <div style={{
      background: C.s1, borderRadius: 14, border: "1px solid " + C.brdL,
      overflow: "hidden", marginBottom: 10,
    }}>
      {/* Header */}
      {editing ? (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid " + C.brdL }}>
          <BlocForm
            initial={bloc}
            onSubmit={data => {
              onChange({ ...bloc, ...data })
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid " + C.brdL }}>
          {/* Drag handle */}
          <div
            {...(dragHandleProps ?? {})}
            style={{ cursor: "grab", color: C.tx3, display: "flex", alignItems: "center", flexShrink: 0 }}
          >
            <GripVertical size={14} />
          </div>

          {/* Badge */}
          <div style={{ padding: "2px 8px", borderRadius: 5, background: VIOLET_S, color: VIOLET, fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
            Bloc {index + 1}
          </div>

          {/* Name */}
          {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={() => {
                onChange({ ...bloc, name: nameValue.trim() || bloc.name })
                setEditingName(false)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') { onChange({ ...bloc, name: nameValue.trim() || bloc.name }); setEditingName(false) }
                if (e.key === 'Escape') setEditingName(false)
              }}
              style={{ flex: 1, padding: "4px 8px", borderRadius: 7, border: "1px solid " + VIOLET, background: C.s2, color: C.tx, fontSize: 14, fontWeight: 700, fontFamily: "inherit", outline: "none" }}
            />
          ) : (
            <div
              onClick={() => { setEditingName(true); setNameValue(bloc.name) }}
              style={{ flex: 1, fontSize: 14, fontWeight: 700, color: C.tx, cursor: "text", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {bloc.name || "Bloc sans nom"}
            </div>
          )}

          {/* Timing tag */}
          <span style={{ fontSize: 10, color: C.tx3, background: C.s2, padding: "2px 7px", borderRadius: 5, border: "1px solid " + C.brdL, flexShrink: 0 }}>
            {timingLabel(bloc)}
          </span>

          {/* Gear */}
          <button
            onClick={() => setEditing(true)}
            style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          ><Settings size={13} /></button>

          {/* Delete */}
          {confirmDelete ? (
            <>
              <button
                onClick={onDelete}
                style={{ padding: "4px 10px", borderRadius: 7, border: "none", background: C.r, color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", flexShrink: 0 }}
              >Supprimer</button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid " + C.brdL, background: "transparent", color: C.tx3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              ><X size={13} /></button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid " + C.r + "40", background: C.rS, color: C.r, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            ><X size={13} /></button>
          )}
        </div>
      )}

      {/* Exercises */}
      <div style={{ padding: "10px 14px" }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleExerciceDragEnd}
        >
          <SortableContext
            items={bloc.exercices.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {bloc.exercices.map((ex, i) => (
                <SortableExercice
                  key={ex.id}
                  exercice={ex}
                  index={i}
                  total={bloc.exercices.length}
                  bloc={bloc}
                  athleteId={athleteId}
                  activeWeek={activeWeek}
                  sessionMultiSemaine={sessionMultiSemaine}
                  onMoveUp={() => moveExercice(i, -1)}
                  onMoveDown={() => moveExercice(i, 1)}
                  onDelete={() => deleteExercice(i)}
                  onChange={updated => updateExercice(i, updated)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add exercise button */}
        <button
          onClick={addExercice}
          style={{
            width: "100%", marginTop: 8,
            padding: "10px 0", borderRadius: 9,
            border: "1px dashed " + C.brdL, background: "transparent",
            color: C.tx3, fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            transition: "border-color 120ms, color 120ms",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = VIOLET; e.currentTarget.style.color = VIOLET }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.brdL; e.currentTarget.style.color = C.tx3 }}
        >
          <Plus size={13} />
          Ajouter un exercice
        </button>
      </div>
    </div>
  )
}
