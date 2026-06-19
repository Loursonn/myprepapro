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
import { Plus } from "lucide-react"
import type { Bloc, ProgSession } from "./types"
import { BlocCard } from "./BlocCard"
import { BlocForm } from "./BlocForm"
import { SemaineNav } from "./SemaineNav"

const VIOLET = "#7B6FFF"

interface SessionBlocEditorProps {
  session: ProgSession
  cycleId: string | undefined
  athleteId: string | undefined
  onChange: (updated: ProgSession) => void
}

interface SortableBlocProps {
  bloc: Bloc
  index: number
  athleteId: string | undefined
  activeWeek: number
  sessionMultiSemaine: boolean
  onChange: (updated: Bloc) => void
  onDelete: () => void
}

function SortableBloc({ bloc, index, athleteId, activeWeek, sessionMultiSemaine, onChange, onDelete }: SortableBlocProps) {
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
        athleteId={athleteId}
        activeWeek={activeWeek}
        sessionMultiSemaine={sessionMultiSemaine}
        onChange={onChange}
        onDelete={onDelete}
        dragHandleProps={listeners as Record<string, unknown>}
      />
    </div>
  )
}

export function SessionBlocEditor({ session, cycleId, athleteId, onChange }: SessionBlocEditorProps) {
  const [isAddingBloc, setIsAddingBloc] = useState(false)
  const [activeWeek, setActiveWeek] = useState(1)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDuplicateWeek() {
    // Duplicate activeWeek params to activeWeek+1 across all exercises in all blocs
    const weekKey = String(activeWeek)
    const nextWeek = String(activeWeek + 1)
    const updatedBlocs = session.blocs.map(bloc => ({
      ...bloc,
      exercices: bloc.exercices.map(ex => {
        const effectiveMulti = session.multi_semaine || (ex.multi_semaine ?? false)
        if (!effectiveMulti) return ex
        if (typeof ex.params === 'object' && !('mode' in ex.params)) {
          const rec = ex.params as Record<string, import("./types").ExerciceParams>
          const thisWeekParams = rec[weekKey]
          if (thisWeekParams) {
            return { ...ex, params: { ...rec, [nextWeek]: { ...thisWeekParams } } }
          }
        }
        return ex
      })
    }))
    onChange({ ...session, blocs: updatedBlocs })
    setActiveWeek(activeWeek + 1)
  }

  function updateBloc(id: string, updated: Bloc) {
    const blocs = session.blocs.map(b => b.id === id ? updated : b)
    onChange({ ...session, blocs })
  }

  function deleteBloc(id: string) {
    const blocs = session.blocs
      .filter(b => b.id !== id)
      .map((b, i) => ({ ...b, sort_order: i }))
    onChange({ ...session, blocs })
  }

  function addBloc(data: Omit<Bloc, 'id' | 'exercices' | 'sort_order'>) {
    const newBloc: Bloc = {
      ...data,
      id: crypto.randomUUID(),
      exercices: [],
      sort_order: session.blocs.length,
    }
    onChange({ ...session, blocs: [...session.blocs, newBloc] })
    setIsAddingBloc(false)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const list = [...session.blocs]
    const from = list.findIndex(b => b.id === active.id)
    const to = list.findIndex(b => b.id === over.id)
    if (from === -1 || to === -1) return
    list.splice(to, 0, list.splice(from, 1)[0])
    onChange({ ...session, blocs: list.map((b, i) => ({ ...b, sort_order: i })) })
  }

  return (
    <div style={{ padding: "12px 0" }}>
      {/* SemaineNav — only if session has multi_semaine */}
      {session.multi_semaine && (
        <div style={{ marginBottom: 12 }}>
          <SemaineNav
            cycleId={cycleId}
            activeWeek={activeWeek}
            onWeekChange={setActiveWeek}
            onDuplicateWeek={handleDuplicateWeek}
          />
        </div>
      )}

      {/* Blocs list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={session.blocs.map(b => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {session.blocs.map((bloc, i) => (
            <SortableBloc
              key={bloc.id}
              bloc={bloc}
              index={i}
              athleteId={athleteId}
              activeWeek={activeWeek}
              sessionMultiSemaine={session.multi_semaine}
              onChange={updated => updateBloc(bloc.id, updated)}
              onDelete={() => deleteBloc(bloc.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Empty blocs state */}
      {!isAddingBloc && session.blocs.length === 0 && (
        <div style={{ textAlign: "center", padding: "30px 20px", color: C.tx3, fontSize: 12 }}>
          Aucun bloc — ajoutes-en un pour commencer.
        </div>
      )}

      {/* Add bloc inline form — below existing blocs */}
      {isAddingBloc && (
        <BlocForm
          onSubmit={addBloc}
          onCancel={() => setIsAddingBloc(false)}
        />
      )}

      {/* Add bloc button */}
      <button
        onClick={() => setIsAddingBloc(true)}
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
        Ajouter un bloc
      </button>
    </div>
  )
}
