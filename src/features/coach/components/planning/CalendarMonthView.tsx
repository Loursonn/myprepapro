import { useState, useCallback, useMemo } from "react";
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday,
  eachDayOfInterval, parseISO,
} from "date-fns";
import type { BlockConfig, Session } from "@/features/shared/types/athlete";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { C } from "@/lib/theme";
import {
  useUnifiedCalendar,
  useAssignWorkout,
  toCalEvent,
} from "@/features/shared/hooks/useUnifiedCalendar";
import type { CalEvent } from "@/features/shared/hooks/useUnifiedCalendar";
import { DayDetailsDrawer } from "./DayDetailsDrawer";
import { QuickAddDialog } from "./QuickAddDialog";

// ── Constants ─────────────────────────────────────────────────────────────────

const DOW_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const TYPE_COLOR: Record<CalEvent["type"], string> = {
  workout:     C.ac,
  test:        C.o,
  competition: C.coach,
};

const TYPE_BG: Record<CalEvent["type"], string> = {
  workout:     C.acS,
  test:        C.oS,
  competition: C.coachS,
};

const STATUS_OPACITY: Record<string, number> = {
  planned:     1,
  in_progress: 1,
  completed:   0.6,
  missed:      0.4,
  skipped:     0.5,
};

// ── EventChip ─────────────────────────────────────────────────────────────────

function EventChip({
  event,
  compact = false,
}: {
  event: CalEvent;
  compact?: boolean;
}) {
  const isProjected = event.raw?.source === "block_plan";
  const st = event.status;

  // Status overrides base type color for completed/missed
  const color = st === "completed" ? C.g
              : st === "missed"    ? C.r
              : TYPE_COLOR[event.type];
  const bg    = st === "completed" ? C.gS
              : st === "missed"    ? C.rS
              : TYPE_BG[event.type];

  return (
    <div
      style={{
        background: isProjected ? (st === "completed" ? C.gS : st === "missed" ? C.rS : "transparent") : bg,
        borderLeft: `2px ${isProjected && st !== "completed" && st !== "missed" ? "dashed" : "solid"} ${color}`,
        borderRadius: "0 4px 4px 0",
        padding: compact ? "1px 5px" : "2px 6px",
        fontSize: compact ? 9 : 10,
        fontWeight: isProjected ? 400 : 600,
        color: color,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        cursor: "pointer",
        maxWidth: "100%",
        fontStyle: isProjected && st !== "completed" && st !== "missed" ? "italic" : "normal",
      }}
    >
      {event.type === "competition" ? "🏆 " : event.type === "test" ? "🧪 " : ""}
      {event.title}
      {isProjected && st !== "completed" && st !== "missed" && (
        <span style={{ opacity: 0.5, marginLeft: 3, fontSize: 8 }}>prévu</span>
      )}
      {event.rpe != null && (
        <span style={{ opacity: 0.85, marginLeft: 4, fontWeight: 700 }}>{event.rpe}/10</span>
      )}
    </div>
  );
}

// ── DraggableSession ─────────────────────────────────────────────────────────

function DraggableSession({
  session,
  isDragging,
}: {
  session: { id: string; name?: string; label?: string };
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: session.id,
    data: session,
  });
  const name = session.name ?? session.label ?? "Séance";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        padding: "7px 10px",
        borderRadius: 8,
        border: "1px solid " + C.ac + "40",
        background: isDragging ? C.ac : C.acS,
        color: isDragging ? "#fff" : C.ac,
        fontSize: 11, fontWeight: 600,
        cursor: "grab",
        userSelect: "none",
        opacity: isDragging ? 0.5 : 1,
        transition: "opacity 120ms",
        transform: transform
          ? `translate(${transform.x}px, ${transform.y}px)`
          : undefined,
      }}
    >
      ⠿ {name}
    </div>
  );
}

// ── DroppableDay ──────────────────────────────────────────────────────────────

function DroppableDay({
  date,
  events,
  isCurrentMonth,
  isActive,
  onClick,
}: {
  date: Date;
  events: CalEvent[];
  isCurrentMonth: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  const dateStr = format(date, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });

  const today     = isToday(date);
  const maxVisible = 3;
  const overflow   = Math.max(0, events.length - maxVisible);

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{
        minHeight: 90,
        background: isOver
          ? C.acS
          : today
          ? C.s2
          : isActive
          ? C.s2 + "80"
          : "transparent",
        border: "1px solid " + (today ? C.ac + "40" : isOver ? C.ac + "60" : C.brd),
        borderRadius: 10,
        padding: "6px 7px",
        cursor: "pointer",
        transition: "background 120ms, border-color 120ms",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        position: "relative",
        opacity: 1,
      }}
    >
      {/* Day number */}
      <div
        style={{
          width: 24, height: 24, borderRadius: "50%",
          background: today ? C.ac : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: today ? 800 : 500,
          color: today ? "#fff" : isCurrentMonth ? C.tx2 : C.tx3,
          alignSelf: "flex-start",
          flexShrink: 0,
        }}
      >
        {format(date, "d")}
      </div>

      {/* Events */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {events.slice(0, maxVisible).map((ev) => (
          <EventChip key={ev.id} event={ev} compact />
        ))}
        {overflow > 0 && (
          <div style={{ fontSize: 9, color: C.tx3, paddingLeft: 4 }}>
            +{overflow} autre{overflow > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Drop indicator */}
      {isOver && (
        <div
          style={{
            position: "absolute", inset: 0, borderRadius: 10,
            border: "2px dashed " + C.ac,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

// ── Session bank sidebar ──────────────────────────────────────────────────────

function SessionBank({
  sessions,
  activeDragId,
}: {
  sessions: Array<{ id: string; name?: string; label?: string }>;
  activeDragId: string | null;
}) {
  const [search, setSearch] = useState("");
  const filtered = sessions.filter((s) => {
    const name = s.name ?? s.label ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div
      style={{
        width: 200, flexShrink: 0,
        background: C.s1,
        borderRadius: 14,
        border: "1px solid " + C.brd,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        maxHeight: "100%",
      }}
    >
      <div style={{ padding: "10px 12px", borderBottom: "1px solid " + C.brd }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.ac, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
          Banque séances
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer..."
          style={{
            width: "100%", padding: "5px 8px", borderRadius: 7,
            border: "1px solid " + C.brdL, background: C.s2,
            color: C.tx, fontSize: 11, fontFamily: "inherit", outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
      <div
        style={{
          flex: 1, overflowY: "auto", padding: "8px",
          display: "flex", flexDirection: "column", gap: 5,
          scrollbarWidth: "none",
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ fontSize: 11, color: C.tx3, textAlign: "center", padding: "12px 0" }}>
            Aucune séance
          </div>
        ) : (
          filtered.map((s) => (
            <DraggableSession
              key={s.id}
              session={s}
              isDragging={activeDragId === s.id}
            />
          ))
        )}
      </div>
      <div style={{ padding: "8px 10px", borderTop: "1px solid " + C.brd }}>
        <div style={{ fontSize: 9, color: C.tx3, textAlign: "center" }}>
          ↕ Glisser sur le calendrier
        </div>
      </div>
    </div>
  );
}

// ── CalendarMonthView ─────────────────────────────────────────────────────────

interface CalendarMonthViewProps {
  athleteId: string;
  coachId: string;
  sessions: Session[];
  blockConfig?: BlockConfig;
  setBlockConfig?: (fn: (prev: BlockConfig) => BlockConfig) => void;
  exos?: Record<string, unknown[]>;
  sets?: Record<string, unknown[]>;
  completedSessions?: Record<number, string[]>;
  currentWeek?: number;
}

export function CalendarMonthView({
  athleteId,
  coachId,
  sessions,
  blockConfig,
  setBlockConfig,
  exos,
  sets,
  completedSessions = {},
  currentWeek = 1,
}: CalendarMonthViewProps) {
  const [month, setMonth]             = useState(new Date());
  const [drawerDay, setDrawerDay]     = useState<Date | null>(null);
  const [quickAddDay, setQuickAddDay] = useState<Date | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const { monthRange, gridStartDate, gridEndDate } = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd   = endOfMonth(month);
    const gs = startOfWeek(monthStart, { weekStartsOn: 1 });
    const ge = endOfWeek(monthEnd,   { weekStartsOn: 1 });
    return {
      monthRange:   { start: format(gs, "yyyy-MM-dd"), end: format(ge, "yyyy-MM-dd") },
      gridStartDate: gs,
      gridEndDate:   ge,
    };
  }, [month]);

  const { data: rawEvents = [], isLoading } = useUnifiedCalendar(athleteId, monthRange);
  const realEvents = useMemo(() => rawEvents.map(toCalEvent), [rawEvents]);
  const { mutate: assignWorkout }           = useAssignWorkout();

  // ── Enrich realEvents: override status from completedSessions (source of truth) ──
  const enrichedRealEvents = useMemo(() => {
    if (!blockConfig?.startDate) return realEvents;
    const blockStart = startOfWeek(parseISO(blockConfig.startDate), { weekStartsOn: 1 });
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
    return realEvents.map(e => {
      if (e.type !== "workout" || !e.raw?.session_id) return e;
      const sessId = e.raw.session_id as string;
      const weekNum = Math.floor((parseISO(e.date).getTime() - blockStart.getTime()) / MS_WEEK) + 1;
      if (weekNum < 1) return e;
      const raw = { ...e.raw, week: weekNum };
      if ((completedSessions[weekNum] ?? []).includes(sessId)) return { ...e, status: "completed", raw };
      if (weekNum < currentWeek) return { ...e, status: "missed", raw };
      return { ...e, raw };
    });
  }, [realEvents, blockConfig, completedSessions, currentWeek]);

  // ── Project block sessions onto calendar dates ────────────────────────────
  const projectedEvents = useMemo<CalEvent[]>(() => {
    if (!blockConfig?.startDate || !sessions.length) return [];

    // Snap to Monday of the week containing startDate
    const blockStart = startOfWeek(parseISO(blockConfig.startDate), { weekStartsOn: 1 });

    // Build set of already-logged session_id:date to avoid duplication
    const logged = new Set(
      enrichedRealEvents
        .filter((e) => e.type === "workout" && e.raw?.session_id)
        .map((e) => `${e.raw.session_id}:${e.date}`),
    );

    const out: CalEvent[] = [];
    for (let w = 0; w < (blockConfig.totalWeeks ?? 8); w++) {
      for (const sess of sessions) {
        // Per-week day override → fallback to default day_of_week
        const dow = (sess.weekDays?.[String(w + 1)] ?? sess.day_of_week) as number | undefined;
        if (dow == null) continue;

        const d    = addDays(blockStart, w * 7 + dow);
        if (d < gridStartDate || d > gridEndDate) continue;

        const dateStr = format(d, "yyyy-MM-dd");
        if (logged.has(`${sess.id}:${dateStr}`)) continue;

        const weekNum = w + 1;
        const isDone = (completedSessions[weekNum] ?? []).includes(sess.id);
        const isPast = weekNum < currentWeek;
        const projStatus = isDone ? "completed" : isPast ? "missed" : "planned";

        out.push({
          id:     `block-${sess.id}-w${weekNum}`,
          title:  sess.name,
          date:   dateStr,
          type:   "workout",
          status: projStatus,
          raw:    { session_id: sess.id, source: "block_plan", week: weekNum },
        });
      }
    }
    return out;
  }, [blockConfig, sessions, gridStartDate, gridEndDate, enrichedRealEvents, completedSessions, currentWeek]);

  const events = useMemo(
    () => [...enrichedRealEvents, ...projectedEvents],
    [enrichedRealEvents, projectedEvents],
  );

  // Sensors : require 8px of movement before drag starts (prevent accidental drags)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Build calendar grid — includes days from adjacent months to complete the ISO weeks
  const gridDays = eachDayOfInterval({ start: gridStartDate, end: gridEndDate });

  // Group events by date
  const eventsByDate = events.reduce<Record<string, CalEvent[]>>((acc, ev) => {
    (acc[ev.date] ??= []).push(ev);
    return acc;
  }, {});

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = e;
      if (!over) return;

      const dateStr = String(over.id);          // "yyyy-MM-dd"
      const sess    = active.data.current as { id: string; name?: string; label?: string };
      if (!sess) return;

      assignWorkout({
        sessionId: sess.id,
        sessionName: sess.name ?? sess.label ?? "Séance",
        athleteId,
        coachId,
        date: dateStr,
      });
    },
    [assignWorkout, athleteId, coachId],
  );

  const activeDragSession = sessions.find((s) => s.id === activeDragId) ?? null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Calendar ── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Month navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              onClick={() => setMonth((m) => subMonths(m, 1))}
              style={{
                width: 36, height: 36, borderRadius: 10,
                border: "1px solid " + C.brdL, background: "transparent",
                color: C.tx3, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ChevronLeft size={18} />
            </button>

            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.tx, textTransform: "capitalize" }}>
                {format(month, "MMMM yyyy", { locale: fr })}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 4 }}>
                {[
                  { label: "Séance", color: C.ac },
                  { label: "Test",   color: C.o  },
                  { label: "Compét", color: C.coach },
                ].map(({ label, color }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                    <span style={{ fontSize: 9, color: C.tx3 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              style={{
                width: 36, height: 36, borderRadius: 10,
                border: "1px solid " + C.brdL, background: "transparent",
                color: C.tx3, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Block-program start-date prompt / legend */}
          {blockConfig && (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px", borderRadius: 10,
                background: C.s1, border: "1px solid " + C.brd,
                fontSize: 11, flexWrap: "wrap",
              }}
            >
              <span style={{ color: C.tx3, fontWeight: 600 }}>📋 Cycle :</span>
              {blockConfig.blockName && (
                <span style={{ color: C.tx, fontWeight: 600 }}>{blockConfig.blockName}</span>
              )}
              <span style={{ color: C.tx3 }}>·</span>
              <label style={{ display: "flex", alignItems: "center", gap: 6, color: C.tx3 }}>
                Début :
                <input
                  type="date"
                  value={blockConfig.startDate ?? ""}
                  onChange={(e) =>
                    setBlockConfig?.((prev) => ({ ...prev, startDate: e.target.value || null }))
                  }
                  style={{
                    padding: "3px 7px", borderRadius: 6,
                    border: "1px solid " + (blockConfig.startDate ? C.brdL : C.o + "60"),
                    background: C.s2,
                    color: blockConfig.startDate ? C.tx : C.o,
                    fontSize: 11, fontFamily: "inherit",
                  }}
                />
              </label>
              {blockConfig.startDate && projectedEvents.length === 0 && (
                <span style={{ color: C.tx3, fontSize: 10 }}>
                  (aucune séance dans ce mois)
                </span>
              )}
              {projectedEvents.length > 0 && (
                <span style={{ color: C.tx3, fontSize: 10 }}>
                  — <span style={{ fontStyle: "italic" }}>prévu</span> = séances du programme
                </span>
              )}
            </div>
          )}

          {/* Grid */}
          <div
            style={{
              background: C.s1, borderRadius: 16,
              border: "1px solid " + C.brd, overflow: "hidden",
            }}
          >
            {/* DOW header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {DOW_LABELS.map((d) => (
                <div
                  key={d}
                  style={{
                    padding: "8px 0", textAlign: "center",
                    fontSize: 10, fontWeight: 700, color: C.tx3,
                    textTransform: "uppercase", letterSpacing: "0.4px",
                    borderBottom: "1px solid " + C.brd,
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            {isLoading ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div
                  style={{
                    width: 24, height: 24, border: "2px solid " + C.brdL,
                    borderTopColor: C.ac, borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                    margin: "0 auto",
                  }}
                />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, padding: 2 }}>
                {gridDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  return (
                    <DroppableDay
                      key={dateStr}
                      date={day}
                      events={eventsByDate[dateStr] ?? []}
                      isCurrentMonth={isSameMonth(day, month)}
                      isActive={!!(drawerDay && isSameDay(day, drawerDay))}
                      onClick={() => setDrawerDay(day)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats bar */}
          {events.length > 0 && (
            <div
              style={{
                display: "flex", gap: 16,
                background: C.s1, borderRadius: 12, padding: "10px 16px",
                border: "1px solid " + C.brd, flexWrap: "wrap",
              }}
            >
              {[
                { label: "Séances",      count: events.filter((e) => e.type === "workout").length,     color: C.ac    },
                { label: "Complétées",   count: events.filter((e) => e.status === "completed").length, color: C.g     },
                { label: "Manquées",     count: events.filter((e) => e.status === "missed").length,    color: C.r     },
                { label: "Tests",        count: events.filter((e) => e.type === "test").length,        color: C.o     },
                { label: "Compétitions", count: events.filter((e) => e.type === "competition").length, color: C.coach },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color }}>{count}</span>
                  <span style={{ fontSize: 10, color: C.tx3 }}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Session Bank ── */}
        <SessionBank sessions={sessions} activeDragId={activeDragId} />
      </div>

      {/* Drag overlay — ghost of the dragged item */}
      <DragOverlay dropAnimation={null}>
        {activeDragSession && (
          <div
            style={{
              padding: "7px 10px", borderRadius: 8,
              border: "1px solid " + C.ac + "60",
              background: C.ac, color: "#fff",
              fontSize: 11, fontWeight: 600,
              boxShadow: "0 8px 24px rgba(168,85,247,0.4)",
              pointerEvents: "none",
            }}
          >
            ⠿ {activeDragSession.name ?? activeDragSession.label ?? "Séance"}
          </div>
        )}
      </DragOverlay>

      {/* Day details drawer */}
      <DayDetailsDrawer
        open={!!drawerDay}
        onClose={() => setDrawerDay(null)}
        day={drawerDay}
        events={events}
        athleteId={athleteId}
        onQuickAdd={(day) => setQuickAddDay(day)}
        exos={exos}
        sets={sets}
      />

      {/* Quick-add dialog (also from empty slot click) */}
      <QuickAddDialog
        open={!!quickAddDay}
        onClose={() => setQuickAddDay(null)}
        date={quickAddDay}
        athleteId={athleteId}
        coachId={coachId}
        sessions={sessions}
      />

      {/* Empty slot click → quick-add (secondary trigger via drawer "+" button works,
          but user can also long-press on empty day — handled in DroppableDay click
          when there are no events) */}
    </DndContext>
  );
}
