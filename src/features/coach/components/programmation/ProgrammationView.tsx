import { useState, useRef } from "react"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { C } from "@/lib/theme"
import { Plus } from "lucide-react"
import { useProgrammation } from "./hooks/useProgrammation"
import { useUpdateProgrammation } from "./hooks/useUpdateProgrammation"
import type { Bloc } from "./types"
import { BlocCard } from "./BlocCard"
import { BlocForm } from "./BlocForm"
import { CardSkeleton } from "@/features/shared/components/skeletons"

const VIOLET = "#7B6FFF"

interface ProgrammationViewProps {
  athleteId: string | undefined
  cycleId: string | undefined
}

interface SortableBlocProps {
  bloc: Bloc
  index: number
  cycleId: string | undefined
  athleteId: string | undefined
  onChange: (updated: Bloc) => void
  onDelete: () => void
}

function SortableBloc({ bloc, index, cycleId, athleteId, onChange, onDelete }: SortableBlocProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bloc.id })
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
      <BlocCard
        bloc={bloc}
        index={index}
        cycleId={cycleId}
        athleteId={athleteId}
        onChange={onChange}
        onDelete={onDelete}
        dragHandleProps={listeners as Record<string, unknown>}
      />
    </div>
  )
}

export function ProgrammationView({ athleteId, cycleId }: ProgrammationViewProps) {
  const { data: blocs = [], isLoading } = useProgrammation(athleteId)
  const updateMutation = useUpdateProgrammation(athleteId)
  const [isAddingBloc, setIsAddingBloc] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function debouncedSave(updated: Bloc[]) {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => updateMutation.mutate(updated), 500)
  }

  function updateBloc(id: string, updated: Bloc) {
    const next = blocs.map(b => b.id === id ? updated : b)
    debouncedSave(next)
  }

  function deleteBloc(id: string) {
    const next = blocs.filter(b => b.id !== id).map((b, i) => ({ ...b, sort_order: i }))
    updateMutation.mutate(next)
  }

  function addBloc(data: Omit<Bloc, 'id' | 'exercices' | 'sort_order'>) {
    const newBloc: Bloc = {
      ...data,
      id: crypto.randomUUID(),
      exercices: [],
      sort_order: blocs.length,
    }
    const next = [...blocs, newBloc]
    updateMutation.mutate(next)
    setIsAddingBloc(false)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const list = [...blocs]
    const from = list.findIndex(b => b.id === active.id)
    const to = list.findIndex(b => b.id === over.id)
    if (from === -1 || to === -1) return
    list.splice(to, 0, list.splice(from, 1)[0])
    const updated = list.map((b, i) => ({ ...b, sort_order: i }))
    updateMutation.mutate(updated)
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2].map(i => <CardSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button
          onClick={() => setIsAddingBloc(true)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "8px 16px", borderRadius: 9,
            border: "none", background: VIOLET, color: "#fff",
            fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <Plus size={13} />
          Ajouter un bloc
        </button>
      </div>

      {/* Add bloc inline form */}
      {isAddingBloc && (
        <BlocForm
          onSubmit={addBloc}
          onCancel={() => setIsAddingBloc(false)}
        />
      )}

      {/* Empty state */}
      {!isAddingBloc && blocs.length === 0 && (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏋️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.tx, marginBottom: 4 }}>Aucun bloc</div>
          <div style={{ fontSize: 12, color: C.tx3, marginBottom: 20 }}>
            Crée ton premier bloc pour commencer à programmer les exercices.
          </div>
          <button
            onClick={() => setIsAddingBloc(true)}
            style={{
              padding: "10px 22px", borderRadius: 10,
              border: "none", background: VIOLET, color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <Plus size={14} />
            Créer un bloc
          </button>
        </div>
      )}

      {/* Blocs list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocs.map(b => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {blocs.map((bloc, i) => (
            <SortableBloc
              key={bloc.id}
              bloc={bloc}
              index={i}
              cycleId={cycleId}
              athleteId={athleteId}
              onChange={updated => updateBloc(bloc.id, updated)}
              onDelete={() => deleteBloc(bloc.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
