import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useActivePlan } from "@/features/shared/hooks/useActivePlan";
import { useEnergySession } from "@/features/shared/hooks/useEnergySessions";
import { SessionPreviewModal } from "@/features/coach/components/energy/SessionPreviewModal";
import { EmptyState } from "@/features/shared/components/EmptyState";
import type { ActiveMesocycle, WeekDay, WeekSession } from "@/features/shared/hooks/useActivePlan";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS_FR    = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
const DOW_FULL_FR  = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

const ENERGY_KIND_COLOR: Record<string, string> = {
  vo2: "#A855F7", tempo: "#3B8DF0", seuil: "#F59E0B",
  footing: "#10B981", fartlek: "#EF4444", autre: "#6B7280", custom: "#6B7280",
};
const ENERGY_KIND_LABEL: Record<string, string> = {
  vo2: "VO₂", tempo: "Tempo", seuil: "Seuil",
  footing: "Footing", fartlek: "Fartlek", autre: "Autre", custom: "Custom",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function haptic() { if (navigator.vibrate) navigator.vibrate(10); }

function sessionColor(s: WeekSession): string {
  return s.kind === "energy"
    ? (ENERGY_KIND_COLOR[s.sessionKind ?? ""] ?? "#A855F7")
    : C.ac;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ProgramSkeleton() {
  const pulse: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)", borderRadius: 8,
    animation: "pulse 1.5s ease-in-out infinite",
  };
  return (
    <div style={{ padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ background: C.s1, borderRadius: 20, padding: 20, border: "1px solid " + C.brd, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ ...pulse, width: 80, height: 22 }} />
          <div style={{ ...pulse, width: 60, height: 16 }} />
        </div>
        <div style={{ ...pulse, width: "70%", height: 22 }} />
        <div style={{ ...pulse, width: "100%", height: 4 }} />
        <div style={{ display: "flex", gap: 12 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ ...pulse, width: "60%", height: 18 }} />
              <div style={{ ...pulse, width: "80%", height: 12 }} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...pulse, width: 160, height: 22 }} />
      {[0,1,2,3,4,5,6].map(i => (
        <div key={i} style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.brd, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ ...pulse, width: 80, height: 14 }} />
          <div style={{ ...pulse, width: "100%", height: 44 }} />
        </div>
      ))}
    </div>
  );
}

// ── Energy preview overlay ────────────────────────────────────────────────────

function EnergyPreviewOverlay({
  energySessionId, athleteId, onClose,
}: { energySessionId: string; athleteId: string; onClose: () => void }) {
  const { data: session, isLoading } = useEnergySession(energySessionId);
  if (isLoading) return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.65)" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", zIndex: 61,
        transform: "translate(-50%,-50%)", width: 420, maxWidth: "96vw",
        background: C.s1, borderRadius: 16, border: "1px solid " + C.brd,
        padding: 40, textAlign: "center", color: C.tx3, fontSize: 13,
      }}>Chargement…</div>
    </>
  );
  if (!session) return null;
  return <SessionPreviewModal session={session} athleteId={athleteId} onClose={onClose} />;
}

// ── Plan actif card ───────────────────────────────────────────────────────────

function ActivePlanCard({ meso, weekSessionCount }: { meso: ActiveMesocycle; weekSessionCount: number }) {
  const color = C.ac;
  return (
    <div style={{ background: C.s1, borderRadius: 20, border: "1px solid " + C.brd, overflow: "hidden" }}>
      <div style={{ padding: "18px 18px 0" }}>
        {/* Pill + duration */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 20,
            background: color + "18", color,
            fontSize: 11, fontWeight: 700,
          }}>
            💪 Programme
          </span>
          <span style={{ fontSize: 11, color: C.tx3 }}>{meso.totalWeeks} semaines</span>
        </div>

        {/* Meso name */}
        <div style={{ fontSize: 18, fontWeight: 700, color: C.tx, marginBottom: 12, lineHeight: 1.3 }}>
          {meso.name}
        </div>

        {/* Week progress */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: C.tx3 }}>
            Semaine {meso.currentWeek} sur {meso.totalWeeks}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{meso.progressPct}%</span>
        </div>
        <div style={{ width: "100%", height: 4, borderRadius: 99, background: "rgba(255,255,255,0.08)", marginBottom: 18, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 99, background: color, width: meso.progressPct + "%", transition: "width 0.6s ease" }} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: C.brd, marginBottom: 16 }} />

        {/* 3 stats */}
        <div style={{ display: "flex", marginBottom: 18 }}>
          {[
            { label: "Complétion",     value: meso.completionPct + "%" },
            { label: "Fréquence",      value: meso.frequency != null ? meso.frequency + "/sem" : "—" },
            { label: "Séances / sem",  value: String(weekSessionCount) },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              borderLeft: i > 0 ? "1px solid " + C.brd : "none", paddingTop: 2,
            }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.tx, lineHeight: 1.1 }}>{stat.value}</span>
              <span style={{ fontSize: 10, color: C.tx3, marginTop: 3 }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Phase sub-card */}
      {(meso.objective || meso.macroName) && (
        <div style={{
          margin: "0 12px 12px",
          background: "rgba(59,141,240,0.08)", border: "1px solid rgba(59,141,240,0.25)",
          borderRadius: 12, padding: "11px 14px",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{ fontSize: 16, marginTop: 1 }}>📈</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.b, marginBottom: 2 }}>{meso.macroName}</div>
            {meso.objective && (
              <div style={{ fontSize: 11, color: C.tx3, lineHeight: 1.4 }}>{meso.objective}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Session chip (within a day) ───────────────────────────────────────────────

function SessionChip({
  session,
  onPress,
}: { session: WeekSession; onPress: (s: WeekSession) => void }) {
  const color = sessionColor(session);
  const isDone = session.status === "completed";
  const isMissed = session.status === "missed";

  const meta = session.kind === "energy"
    ? (ENERGY_KIND_LABEL[session.sessionKind ?? ""] ?? "Énergie")
    : "Musculation";

  return (
    <button
      onClick={() => { haptic(); onPress(session); }}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        background: isDone ? C.gS : color + "12",
        border: "none", borderLeft: "4px solid " + (isDone ? C.g : color),
        borderRadius: "0 10px 10px 0",
        padding: "10px 12px",
        cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const,
        minHeight: 44,
        opacity: isMissed ? 0.55 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: C.tx,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {session.sessionName}
        </div>
        <div style={{ fontSize: 10, color: isDone ? C.g : C.tx3, marginTop: 2 }}>
          {meta}{isDone ? " · Complétée ✓" : isMissed ? " · Manquée" : " · Planifiée"}
        </div>
      </div>
      {!isDone && !isMissed && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
          background: color + "20", color,
          flexShrink: 0,
        }}>
          {session.kind === "energy" ? "Voir →" : "Démarrer ▶"}
        </span>
      )}
      {isDone && <span style={{ fontSize: 14, color: C.g, flexShrink: 0 }}>✓</span>}
    </button>
  );
}

// ── Day row ───────────────────────────────────────────────────────────────────

function DayRow({
  day, today, onSessionPress,
}: {
  day: WeekDay;
  today: string;
  onSessionPress: (s: WeekSession) => void;
}) {
  const isToday = day.date === today;
  const isPast  = day.date < today;
  const d       = new Date(day.date + "T12:00:00");
  const dateNum = d.getDate();
  const isEmpty = day.sessions.length === 0;

  return (
    <div style={{
      background: C.s1,
      borderRadius: 16,
      border: "1px solid " + (isToday ? C.ac + "50" : C.brd),
      overflow: "hidden",
    }}>
      {/* Day header */}
      <div style={{
        padding: "10px 14px",
        background: isToday ? C.acS : "transparent",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: isToday ? C.ac : C.s2,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 8, fontWeight: 600, color: isToday ? "rgba(255,255,255,0.8)" : C.tx3, textTransform: "uppercase" }}>
            {DOW_FULL_FR[day.dow].slice(0, 3)}
          </span>
          <span style={{ fontSize: 16, fontWeight: 800, color: isToday ? "#fff" : C.tx, lineHeight: 1.1 }}>
            {dateNum}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          {isToday && (
            <div style={{ fontSize: 9, fontWeight: 700, color: C.ac, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 1 }}>
              Aujourd'hui
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: isEmpty ? 400 : 600, color: isEmpty ? C.tx3 : C.tx }}>
            {isEmpty
              ? (isPast ? "Repos" : "Aucune séance")
              : `${day.sessions.length} séance${day.sessions.length > 1 ? "s" : ""}`}
          </div>
        </div>
        {day.sessions.length > 0 && (
          <div style={{ display: "flex", gap: 4 }}>
            {day.sessions.map(s => (
              <div key={s.id} style={{
                width: 6, height: 6, borderRadius: "50%",
                background: s.status === "completed" ? C.g : sessionColor(s),
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Session list */}
      {day.sessions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 0 6px 14px" }}>
          {day.sessions.map(s => (
            <SessionChip key={s.id} session={s} onPress={onSessionPress} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgramPage() {
  const navigate   = useNavigate();
  const { athleteId } = useAthleteContext();
  const { data, isLoading } = useActivePlan(athleteId ?? "");
  const [energyPreview, setEnergyPreview] = useState<{ id: string } | null>(null);

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();

  function handleSessionPress(s: WeekSession) {
    if (s.kind === "energy" && s.energySessionId) {
      setEnergyPreview({ id: s.energySessionId });
      return;
    }
    if (s.kind === "workout" && s.sessionId) {
      navigate("/athlete/log", {
        state: {
          initialSess: {
            id:          s.sessionId,
            name:        s.sessionName,
            short:       s.sessionName.slice(0, 3).toUpperCase(),
            day_of_week: (new Date(s.scheduledDate + "T12:00:00").getDay() + 6) % 7,
          },
        },
      });
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", scrollbarWidth: "none" }}>
      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 45, zIndex: 5,
        background: "#08090C", borderBottom: "1px solid " + C.brd,
        padding: "14px 16px", textAlign: "center",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>Programme</div>
      </div>

      {isLoading ? (
        <ProgramSkeleton />
      ) : (
        <div style={{ padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── Plan actif ── */}
          <section>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
              Plan actif
            </div>
            {data?.mesocycle ? (
              <ActivePlanCard meso={data.mesocycle} weekSessionCount={data.weekSessionCount} />
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Aucun plan actif"
                description="Ton coach n'a pas encore assigné de programme pour cette période."
                cta={{ label: "Demande à ton coach", onClick: () => {} }}
              />
            )}
          </section>

          {/* ── Cette semaine ── */}
          <section>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.tx, marginBottom: 16 }}>
              Cette semaine
            </div>
            {!data?.weekDays.length ? (
              <div style={{ background: C.s1, borderRadius: 14, border: "1px solid " + C.brd, padding: "24px 16px", textAlign: "center", color: C.tx3, fontSize: 12 }}>
                Aucune séance cette semaine
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.weekDays.map(day => (
                  <DayRow
                    key={day.date}
                    day={day}
                    today={today}
                    onSessionPress={handleSessionPress}
                  />
                ))}
              </div>
            )}
          </section>

        </div>
      )}

      {/* Energy preview overlay */}
      {energyPreview && (
        <EnergyPreviewOverlay
          energySessionId={energyPreview.id}
          athleteId={athleteId ?? ""}
          onClose={() => setEnergyPreview(null)}
        />
      )}
    </div>
  );
}
