import { useState, useMemo, useCallback } from "react";
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  eachDayOfInterval,
  isSameMonth, isSameDay, isToday, isPast,
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { C } from "@/lib/theme";
import type { EnergySessionAssignmentRow, SessionKind } from "@/types/energy";
import { useEnergyAssignments, useUpdateEnergyAssignment } from "@/features/shared/hooks/useEnergyAssignments";
import { EnergyAssignmentDrawer } from "./EnergyAssignmentDrawer";
import { SessionPickerDialog } from "./SessionPickerDialog";

// ── Constants ─────────────────────────────────────────────────────────────────

const DOW_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const KIND_COLORS: Record<string, string> = {
  vo2:     "#A855F7",
  tempo:   "#3B8DF0",
  seuil:   "#FB923C",
  footing: "#22C993",
  fartlek: "#E8C93A",
  autre:   "#7C7480",
  custom:  "#F472B6",
};

const KIND_LABELS: Record<string, string> = {
  vo2:     "VO₂",
  tempo:   "Tempo",
  seuil:   "Seuil",
  footing: "Footing",
  fartlek: "Fartlek",
  autre:   "Autre",
  custom:  "Custom",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  athleteId: string;
}

// ── EventBadge (draggable) ────────────────────────────────────────────────────

function EventBadge({
  assignment,
  onClick,
}: {
  assignment: EnergySessionAssignmentRow;
  onClick: (a: EnergySessionAssignmentRow) => void;
}) {
  const kind = (assignment.energy_sessions?.session_kind ?? "autre") as SessionKind;
  const color = KIND_COLORS[kind] ?? C.tx3;
  const kindLabel = KIND_LABELS[kind] ?? kind;
  const name = assignment.energy_sessions?.name ?? "Séance";

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: assignment.id,
    data: { assignment },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick(assignment);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px",
        borderRadius: 4,
        background: color + "18",
        borderLeft: `2px solid ${color}`,
        cursor: "grab",
        opacity: isDragging ? 0.3 : 1,
        marginBottom: 2,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}
      >
        {name}
      </span>
      <span style={{ fontSize: 9, color: color + "CC", flexShrink: 0 }}>
        {kindLabel}
      </span>
    </div>
  );
}

// ── DayCell ───────────────────────────────────────────────────────────────────

function DayCell({
  day,
  isCurrentMonth,
  assignments,
  onClickAssignment,
  onClickDay,
}: {
  day: Date;
  isCurrentMonth: boolean;
  assignments: EnergySessionAssignmentRow[];
  onClickAssignment: (a: EnergySessionAssignmentRow) => void;
  onClickDay: (date: string) => void;
}) {
  const dateStr = format(day, "yyyy-MM-dd");
  const today = isToday(day);
  const past = isPast(day) && !today;

  const { setNodeRef, isOver } = useDroppable({ id: dateStr });

  return (
    <div
      ref={setNodeRef}
      onClick={() => onClickDay(dateStr)}
      style={{
        minHeight: 80,
        background: isOver
          ? C.acS
          : isCurrentMonth
          ? C.bg
          : C.s2,
        borderRadius: 8,
        border: today
          ? `1.5px solid ${C.ac}`
          : `1px solid ${C.brd}`,
        padding: "6px 6px 4px",
        opacity: past && !isCurrentMonth ? 0.4 : past ? 0.6 : 1,
        cursor: "pointer",
        transition: "background 0.1s",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Day number */}
      <div
        style={{
          fontSize: 11,
          fontWeight: today ? 700 : 500,
          color: today ? C.ac : isCurrentMonth ? C.tx2 : C.tx3,
          marginBottom: 4,
          lineHeight: 1,
        }}
      >
        {format(day, "d")}
      </div>

      {/* Events */}
      <div style={{ flex: 1 }}>
        {assignments.map((a) => (
          <EventBadge key={a.id} assignment={a} onClick={onClickAssignment} />
        ))}
      </div>
    </div>
  );
}

// ── DragOverlayBadge ──────────────────────────────────────────────────────────

function DragOverlayBadge({ assignment }: { assignment: EnergySessionAssignmentRow }) {
  const kind = (assignment.energy_sessions?.session_kind ?? "autre") as SessionKind;
  const color = KIND_COLORS[kind] ?? C.tx3;
  const name = assignment.energy_sessions?.name ?? "Séance";

  return (
    <div
      style={{
        padding: "4px 8px",
        borderRadius: 6,
        background: C.s1,
        border: `1px solid ${color}`,
        color,
        fontSize: 11,
        fontWeight: 600,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        pointerEvents: "none",
      }}
    >
      {name}
    </div>
  );
}

// ── EnergyCalendarView ────────────────────────────────────────────────────────

export function EnergyCalendarView({ athleteId }: Props) {
  const [month, setMonth] = useState(() => new Date());
  const [selectedAssignment, setSelectedAssignment] = useState<EnergySessionAssignmentRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<EnergySessionAssignmentRow | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Grid bounds
  const gridStartDate = useMemo(
    () => startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    [month]
  );
  const gridEndDate = useMemo(
    () => endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    [month]
  );

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStartDate, end: gridEndDate }),
    [gridStartDate, gridEndDate]
  );

  // Fetch assignments
  const { data: assignments = [] } = useEnergyAssignments(athleteId, {
    from: format(gridStartDate, "yyyy-MM-dd"),
    to: format(gridEndDate, "yyyy-MM-dd"),
  });

  const updateMut = useUpdateEnergyAssignment();

  // Group by date
  const byDate = useMemo(() => {
    const map: Record<string, EnergySessionAssignmentRow[]> = {};
    for (const a of assignments) {
      const d = a.scheduled_date;
      if (!map[d]) map[d] = [];
      map[d].push(a);
    }
    return map;
  }, [assignments]);

  // Handlers
  const handleClickAssignment = useCallback((a: EnergySessionAssignmentRow) => {
    setSelectedAssignment(a);
    setDrawerOpen(true);
  }, []);

  const handleClickDay = useCallback((dateStr: string) => {
    setPickerDate(dateStr);
  }, []);

  const handleDragStart = useCallback(
    (event: { active: { data: { current?: { assignment?: EnergySessionAssignmentRow } } } }) => {
      const a = event.active.data.current?.assignment ?? null;
      setActiveAssignment(a);
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveAssignment(null);
      const { active, over } = event;
      if (!over) return;
      const assignmentId = active.id as string;
      const newDate = over.id as string;
      // Find the assignment
      const found = assignments.find((a) => a.id === assignmentId);
      if (!found) return;
      if (found.scheduled_date === newDate) return;
      updateMut.mutate({ id: assignmentId, athleteId, scheduled_date: newDate });
    },
    [assignments, athleteId, updateMut]
  );

  const monthLabel = format(month, "MMMM yyyy", { locale: fr });
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  return (
    <div style={{ width: "100%" }}>
      {/* Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => setMonth((m) => subMonths(m, 1))}
          style={{
            background: C.s2,
            border: `1px solid ${C.brd}`,
            borderRadius: 8,
            color: C.tx,
            padding: "6px 12px",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ← Précédent
        </button>

        <div style={{ fontSize: 15, fontWeight: 700, color: C.tx }}>
          {monthLabelCapitalized}
        </div>

        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          style={{
            background: C.s2,
            border: `1px solid ${C.brd}`,
            borderRadius: 8,
            color: C.tx,
            padding: "6px 12px",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Suivant →
        </button>
      </div>

      {/* Day headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          marginBottom: 4,
        }}
      >
        {DOW_LABELS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: 700,
              color: C.tx3,
              padding: "4px 0",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid with DnD */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
          }}
        >
          {days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayAssignments = byDate[dateStr] ?? [];
            return (
              <DayCell
                key={dateStr}
                day={day}
                isCurrentMonth={isSameMonth(day, month)}
                assignments={dayAssignments}
                onClickAssignment={handleClickAssignment}
                onClickDay={handleClickDay}
              />
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeAssignment ? (
            <DragOverlayBadge assignment={activeAssignment} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Assignment drawer */}
      <EnergyAssignmentDrawer
        assignment={selectedAssignment}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        athleteId={athleteId}
      />

      {/* Session picker */}
      {pickerDate && (
        <SessionPickerDialog
          open={true}
          onClose={() => setPickerDate(null)}
          date={pickerDate}
          athleteId={athleteId}
        />
      )}
    </div>
  );
}

export default EnergyCalendarView;
