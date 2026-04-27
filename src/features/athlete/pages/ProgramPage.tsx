import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "@/lib/theme";
import { useWeekProgram } from "@/features/shared/hooks/useWeekProgram";

const DOW_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR  = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];

function toMonday(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function weekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.getDate()} ${MONTHS_FR[monday.getMonth()]} – ${sunday.getDate()} ${MONTHS_FR[sunday.getMonth()]}`;
}

export default function ProgramPage() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState<string>(() => isoDate(toMonday(new Date())));

  const days = useWeekProgram(weekStart);

  const currentMonday = new Date(weekStart);
  const today = isoDate(new Date());

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(isoDate(d));
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(isoDate(d));
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", scrollbarWidth: "none" }}>
      {/* Sticky week selector */}
      <div
        style={{
          position: "sticky", top: 45, zIndex: 5,
          background: C.bg, borderBottom: "1px solid " + C.brd,
          padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <button
          onClick={prevWeek}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: "1px solid " + C.brdL, background: "transparent",
            color: C.tx3, fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit", minWidth: 44, minHeight: 44,
          }}
        >
          ←
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>
            {weekLabel(currentMonday)}
          </div>
          <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>
            {weekStart === isoDate(toMonday(new Date())) ? "Cette semaine" : ""}
          </div>
        </div>
        <button
          onClick={nextWeek}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: "1px solid " + C.brdL, background: "transparent",
            color: C.tx3, fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit", minWidth: 44, minHeight: 44,
          }}
        >
          →
        </button>
      </div>

      {/* 7 day cards */}
      <div style={{ padding: "12px 16px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
        {days.map((day) => {
          const isToday = day.date === today;
          const hasSessions = day.sessions.length > 0;

          return (
            <div
              key={day.date}
              style={{
                background: "#0F1014",
                border: "1px solid " + (isToday ? C.coach + "50" : "#1A1B22"),
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              {/* Day header */}
              <div
                style={{
                  padding: "10px 14px",
                  display: "flex", alignItems: "center", gap: 10,
                  background: isToday ? "rgba(212,83,142,0.06)" : "transparent",
                  borderBottom: hasSessions ? "1px solid " + C.brd : "none",
                }}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: isToday ? C.coach : C.s2,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontSize: 8, color: isToday ? "rgba(255,255,255,0.8)" : C.tx3, fontWeight: 600 }}>
                    {DOW_LABELS[day.dow]}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: isToday ? "#fff" : C.tx, lineHeight: 1.1 }}>
                    {new Date(day.date + "T12:00:00").getDate()}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {isToday && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.coach, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 1 }}>
                      Aujourd'hui
                    </div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: hasSessions ? 600 : 400, color: hasSessions ? C.tx : C.tx3 }}>
                    {hasSessions ? `${day.sessions.length} séance${day.sessions.length > 1 ? "s" : ""}` : "Repos"}
                  </div>
                </div>
              </div>

              {/* Sessions list */}
              {day.sessions.map(({ session, exercises, isCompleted }) => (
                <button
                  key={session.id}
                  onClick={() => navigate(`workout/${session.id}`)}
                  style={{
                    width: "100%", padding: "12px 14px",
                    border: "none", background: "transparent",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 12,
                    borderBottom: "1px solid " + C.brd,
                    transition: "background 150ms", minHeight: 44,
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = C.s1)}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  {/* Status indicator */}
                  <div
                    style={{
                      width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                      background: isCompleted ? "#22C99320" : "rgba(212,83,142,0.12)",
                      border: "1px solid " + (isCompleted ? "#22C99350" : "#D4538E40"),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11,
                    }}
                  >
                    {isCompleted ? "✓" : "▶"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {session.name}
                    </div>
                    <div style={{ fontSize: 10, color: C.tx3, marginTop: 1 }}>
                      {exercises.length} exercice{exercises.length > 1 ? "s" : ""}
                      {isCompleted ? " · Complétée ✓" : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: C.tx3 }}>›</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
