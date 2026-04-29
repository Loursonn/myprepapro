import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { X, Trash2, Plus } from "lucide-react";
import { C } from "@/lib/theme";
import type { CalEvent } from "@/features/shared/hooks/useUnifiedCalendar";
import { useDeleteCalendarEvent } from "@/features/shared/hooks/useUnifiedCalendar";

// ── Color helpers ─────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<CalEvent["type"], string> = {
  workout:     C.ac,
  test:        C.o,
  competition: C.coach,
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  planned:     { label: "Planifiée",  color: C.tx3 },
  in_progress: { label: "En cours",  color: C.b   },
  completed:   { label: "Complétée", color: C.g   },
  missed:      { label: "Manquée",   color: C.r   },
  skipped:     { label: "Sautée",    color: C.o   },
};

// ── EventCard ─────────────────────────────────────────────────────────────────

function EventCard({
  event,
  athleteId,
}: {
  event: CalEvent;
  athleteId: string;
}) {
  const color = TYPE_COLOR[event.type];
  const { mutate: del } = useDeleteCalendarEvent();
  const statusInfo = event.status ? STATUS_LABEL[event.status] : null;

  return (
    <div
      style={{
        background: C.s2,
        borderRadius: 12,
        borderLeft: `3px solid ${color}`,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.tx, marginBottom: 2 }}>
            {event.title}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.4px",
                textTransform: "uppercase", color,
              }}
            >
              {event.type === "workout" ? "Séance" : event.type === "test" ? "Test" : "Compétition"}
            </span>
            {statusInfo && (
              <span style={{ fontSize: 10, color: statusInfo.color }}>
                {statusInfo.label}
              </span>
            )}
            {event.rpe != null && (
              <span
                style={{
                  fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                  background: C.acS, color: C.ac,
                }}
              >
                RPE {event.rpe}/10
              </span>
            )}
          </div>
        </div>

        {event.type !== "competition" && (
          <button
            onClick={() => del({ id: event.id, type: event.type, athleteId })}
            style={{
              width: 28, height: 28, borderRadius: 8,
              border: "1px solid " + C.r + "30", background: "transparent",
              color: C.r, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, opacity: 0.6,
            }}
            title="Supprimer"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── DayDetailsDrawer ──────────────────────────────────────────────────────────

interface DayDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  day: Date | null;
  events: CalEvent[];
  athleteId: string;
  onQuickAdd: (day: Date) => void;
}

export function DayDetailsDrawer({
  open,
  onClose,
  day,
  events,
  athleteId,
  onQuickAdd,
}: DayDetailsDrawerProps) {
  if (!open || !day) return null;

  const dayEvents = events.filter((e) => e.date === format(day, "yyyy-MM-dd"));
  const workouts     = dayEvents.filter((e) => e.type === "workout");
  const tests        = dayEvents.filter((e) => e.type === "test");
  const competitions = dayEvents.filter((e) => e.type === "competition");

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.5)",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 380, maxWidth: "90vw",
          background: C.s1,
          borderLeft: "1px solid " + C.brd,
          display: "flex", flexDirection: "column",
          animation: "slideIn 200ms ease-out",
        }}
      >
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            padding: "16px 20px", borderBottom: "1px solid " + C.brd,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.tx }}>
              {format(day, "d MMMM yyyy", { locale: fr })}
            </div>
            <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>
              {dayEvents.length === 0
                ? "Aucun événement"
                : `${dayEvents.length} événement${dayEvents.length > 1 ? "s" : ""}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "1px solid " + C.brdL, background: "transparent",
              color: C.tx3, cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1, overflowY: "auto", padding: "16px 20px",
            display: "flex", flexDirection: "column", gap: 20,
          }}
        >
          {dayEvents.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.tx3, fontSize: 13 }}>
              Journée libre
            </div>
          )}

          {workouts.length > 0 && (
            <section>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.ac, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                Séances
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {workouts.map((e) => <EventCard key={e.id} event={e} athleteId={athleteId} />)}
              </div>
            </section>
          )}

          {tests.length > 0 && (
            <section>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.o, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                Tests
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tests.map((e) => <EventCard key={e.id} event={e} athleteId={athleteId} />)}
              </div>
            </section>
          )}

          {competitions.length > 0 && (
            <section>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.coach, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                Compétitions
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {competitions.map((e) => <EventCard key={e.id} event={e} athleteId={athleteId} />)}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid " + C.brd, flexShrink: 0 }}>
          <button
            onClick={() => { onClose(); onQuickAdd(day); }}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 12,
              border: "1px solid " + C.ac + "40", background: C.acS,
              color: C.ac, fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Plus size={15} />
            Ajouter séance / test
          </button>
        </div>
      </div>
    </>
  );
}
