import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useTodayWellness } from "@/features/shared/hooks/useTodayWellness";
import { useReadinessScore } from "@/features/shared/hooks/useReadinessScore";
import { useUpcomingCompetition } from "@/features/shared/hooks/useUpcomingCompetition";
import { useWeekSchedule } from "@/features/shared/hooks/useWeekSchedule";
import { COMPETITION_META } from "@/types/planning";
import type { DayProgram } from "@/features/shared/hooks/useWeekProgram";

// ── Helpers ───────────────────────────────────────────────────────────────────

function haptic() {
  if (navigator.vibrate) navigator.vibrate(10);
}

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

function todayFr(): string {
  const d = new Date();
  return `${DAYS_FR[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

// ── Readiness circle (SVG) ────────────────────────────────────────────────────

function ReadinessCircle({ score, color }: { score: number; color: string }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  // Use gradient for score > 70 (violet→rose), solid color otherwise
  const useGradient = score > 70;
  const gradientId = "scoreGradient";
  return (
    <div style={{ position: "relative", width: 136, height: 136, flexShrink: 0 }}>
      <svg width={136} height={136} viewBox="0 0 136 136" style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>
        </defs>
        <circle cx={68} cy={68} r={r} fill="none" stroke="rgba(124,116,128,0.2)" strokeWidth={10} />
        <circle
          cx={68} cy={68} r={r} fill="none"
          stroke={useGradient ? `url(#${gradientId})` : color}
          strokeWidth={10}
          strokeDasharray={String(circ)}
          strokeDashoffset={String(circ * (1 - score / 100))}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: useGradient ? "#A855F7" : color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>/ 100</div>
      </div>
    </div>
  );
}



// ── Wellness field labels (for readiness display) ─────────────────────────────

const WELL_FIELDS = [
  { key: "fatigue", label: "Fatigue",  icon: "😴", inv: true  },
  { key: "sommeil", label: "Sommeil",  icon: "🌙", inv: false },
  { key: "stress",  label: "Stress",   icon: "😰", inv: true  },
  { key: "energie", label: "Énergie",  icon: "⚡", inv: false },
  { key: "doms",    label: "DOMS",     icon: "💪", inv: true  },
];

// ── Day preview bottom sheet ──────────────────────────────────────────────────

const DAYS_FULL_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface DayPreviewSheetProps {
  day: DayProgram | null;
  onClose: () => void;
  onStartSession: (sess: DayProgram["sessions"][number]["session"]) => void;
}

function DayPreviewSheet({ day, onClose, onStartSession }: DayPreviewSheetProps) {
  if (!day) return null;
  const date = new Date(day.date + "T12:00:00");
  const dateLabel = `${DAYS_FULL_FR[day.dow]} ${date.getDate()} ${MONTHS_FR[date.getMonth()]}`;
  const isToday = day.date === new Date().toISOString().split("T")[0];
  const isPast  = day.date < new Date().toISOString().split("T")[0];
  const empty   = day.sessions.length === 0 && day.tests.length === 0;

  return (
    <Drawer open={!!day} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent style={{ background: C.s1, borderTop: "1px solid " + C.brd, padding: "0 0 32px" }}>
        <DrawerHeader style={{ padding: "16px 20px 8px" }}>
          <DrawerTitle style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>
            {dateLabel}
            {isToday && (
              <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: C.coachS, color: C.coach }}>
                Aujourd'hui
              </span>
            )}
          </DrawerTitle>
        </DrawerHeader>

        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {empty ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: C.tx3, fontSize: 13 }}>
              😌 Jour de repos — rien de prévu
            </div>
          ) : (
            <>
              {/* Sessions */}
              {day.sessions.map(({ session, exercises, isCompleted }) => (
                <div
                  key={session.id}
                  style={{
                    background: isCompleted ? C.gS : C.coachS,
                    borderRadius: 14, padding: "14px 16px",
                    border: "1px solid " + (isCompleted ? C.g + "40" : C.coach + "40"),
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: exercises.length ? 10 : 0 }}>
                    <div
                      style={{
                        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                        background: isCompleted ? C.g + "20" : C.coach + "20",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16,
                      }}
                    >
                      {isCompleted ? "✅" : "🏋"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{session.name}</div>
                      <div style={{ fontSize: 10, color: C.tx3, marginTop: 1 }}>
                        {session.short} · {exercises.length} exercice{exercises.length !== 1 ? "s" : ""}
                        {isCompleted ? " · Complétée ✓" : isPast ? " · Manquée" : ""}
                      </div>
                    </div>
                  </div>

                  {/* Exercise preview (up to 5) */}
                  {exercises.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: isCompleted || isPast ? 0 : 10 }}>
                      {exercises.slice(0, 5).map((ex) => (
                        <div
                          key={ex.id}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "6px 10px", borderRadius: 8, background: C.s2,
                          }}
                        >
                          <div style={{ fontSize: 11, color: C.tx, flex: 1 }}>{ex.name}</div>
                          {ex.weeks && Object.values(ex.weeks)[0] && (
                            <div style={{ fontSize: 10, color: C.tx3 }}>
                              {(Object.values(ex.weeks)[0] as { sets?: number; repsRange?: string }).sets}×{(Object.values(ex.weeks)[0] as { sets?: number; repsRange?: string }).repsRange}
                            </div>
                          )}
                        </div>
                      ))}
                      {exercises.length > 5 && (
                        <div style={{ fontSize: 10, color: C.tx3, paddingLeft: 10 }}>
                          +{exercises.length - 5} exercice{exercises.length - 5 !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  )}

                  {!isCompleted && !isPast && (
                    <button
                      onClick={() => { onStartSession(session); onClose(); haptic(); }}
                      style={{
                        width: "100%", padding: "11px 0", borderRadius: 10,
                        border: "none", background: C.coach, color: "#fff",
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                        fontFamily: "inherit", minHeight: 44,
                      }}
                    >
                      Démarrer ▶
                    </button>
                  )}
                </div>
              ))}

              {/* Tests */}
              {day.tests.map((t) => {
                const tc = t.type === "musculation" ? "#7B6FFF"
                  : t.type === "energetique" ? "#EF4B4B"
                  : t.type === "specifique" ? "#F5A623"
                  : "#22C993";
                return (
                  <div
                    key={t.id}
                    style={{
                      background: t.completed ? C.gS : tc + "12",
                      borderRadius: 14, padding: "14px 16px",
                      border: "1px solid " + (t.completed ? C.g + "40" : tc + "40"),
                      display: "flex", alignItems: "center", gap: 12,
                    }}
                  >
                    <div style={{ fontSize: 24 }}>🧪</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{t.title}</div>
                      <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>
                        {t.type} · {t.completed ? "Réalisé ✓" : "À faire"}
                      </div>
                    </div>
                    {t.completed && <span style={{ fontSize: 18, color: C.g }}>✓</span>}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ── Forme advice ──────────────────────────────────────────────────────────────

const FORM_FIELDS = [
  { key: "fatigue", label: "Récupération", icon: "😴", inv: true,
    advice: (v: number) => v >= 7 ? "Grande fatigue détectée. Priorise le sommeil et réduis l'intensité cette semaine." : v <= 3 ? "Bonne récupération. Tu peux pousser plus fort." : null },
  { key: "sommeil", label: "Sommeil",      icon: "🌙", inv: false,
    advice: (v: number) => v <= 4 ? "Sommeil insuffisant. Vise 7-9h et couche-toi avant minuit." : null },
  { key: "stress",  label: "Stress",       icon: "😰", inv: true,
    advice: (v: number) => v >= 7 ? "Stress élevé : évite les séances HIIT, préfère l'endurance légère." : null },
  { key: "energie", label: "Énergie",      icon: "⚡", inv: false,
    advice: (v: number) => v <= 3 ? "Énergie basse : vérifie tes apports glucidiques avant les séances." : null },
  { key: "doms",    label: "DOMS",         icon: "💪", inv: true,
    advice: (v: number) => v >= 7 ? "Courbatures importantes. Privilégie du travail léger ou une séance d'activation." : null },
];

function getFormeAdvice(wellness: Record<string, number> | null): Array<{ icon: string; label: string; text: string; color: string }> {
  if (!wellness) return [];
  const tips: Array<{ icon: string; label: string; text: string; color: string }> = [];
  for (const f of FORM_FIELDS) {
    const v = wellness[f.key] as number | undefined;
    if (v == null) continue;
    const tip = f.advice(v);
    if (!tip) continue;
    const isBad = f.inv ? v >= 7 : v <= 3;
    tips.push({ icon: f.icon, label: f.label, text: tip, color: isBad ? C.r : C.o });
  }
  return tips;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState<DayProgram | null>(null);

  const {
    athleteId, athleteProfile, wellnessHistory,
    setShowWellness,
  } = useAthleteContext();

  const wellness        = useTodayWellness();
  const readiness       = useReadinessScore(wellness);
  const { data: nextComp } = useUpcomingCompetition(athleteId);
  const weekDays = useWeekSchedule(null);
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();

  // Derive today's workouts from the date-based week schedule
  const todayDay = weekDays.find((d) => d.date === today);
  const workouts = todayDay?.sessions ?? [];
  const todayTests = todayDay?.tests ?? [];
  const nextWorkout = workouts.find((w) => !w.isCompleted) ?? null;
  const allDoneToday = workouts.length > 0 && workouts.every((w) => w.isCompleted);

  // ── Yesterday's recap ─────────────────────────────────────────────────────
  const yesterdayISO = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const yesterdayWellness = wellnessHistory?.[yesterdayISO] ?? null;
  const yesterdayDay = weekDays.find((d) => d.date === yesterdayISO);
  const yesterdaySessName = yesterdayDay?.sessions.find((s) => s.isCompleted)?.session.name
    ?? yesterdayDay?.sessions[0]?.session.name
    ?? null;

  // ── Wellness trend (last 14 days) ────────────────────────────────────────
  const wellnessTrend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000);
    const iso = d.toISOString().split("T")[0];
    const w = wellnessHistory?.[iso] as Record<string, number> | null | undefined;
    const score = w ? Math.round(
      ((w.fatigue ?? 3) + (w.sommeil ?? 3) + (w.stress ?? 3) + (w.energie ?? 3) + (w.doms ?? 3)) / 25 * 100
    ) : null;
    return { d: iso.slice(5), score };
  });
  const wellnessTrendHasData = wellnessTrend.some((d) => d.score !== null);

  // ── Form advice from today's wellness ────────────────────────────────────
  const formeAdvice = getFormeAdvice(wellness as Record<string, number> | null);

  // ── Average wellness score (last 7 days with data) ───────────────────────
  const recentScores = wellnessTrend.slice(-7).map((d) => d.score).filter((s): s is number => s !== null);
  const avgFormeScore = recentScores.length > 0
    ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length)
    : null;
  const formeColor = avgFormeScore == null ? C.tx3
    : avgFormeScore >= 75 ? C.g
    : avgFormeScore >= 55 ? C.o
    : C.r;
  const formeLabel = avgFormeScore == null ? "—"
    : avgFormeScore >= 75 ? "Excellente"
    : avgFormeScore >= 60 ? "Bonne"
    : avgFormeScore >= 45 ? "Correcte"
    : "À surveiller";

  // ── Today's session CTA ───────────────────────────────────────────────────
  const firstDoneSession = workouts.find((w) => w.isCompleted);
  const todaySession = nextWorkout ?? (allDoneToday ? firstDoneSession ?? null : null);
  const restDay = workouts.length === 0;

  return (
    <>
      <div
        style={{
          maxWidth: 480, margin: "0 auto", padding: "16px 16px 32px",
          scrollbarWidth: "none",
        }}
      >
        {/* Section 1 — Greeting + Readiness */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: C.tx3, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.4px" }}>
            {todayFr()}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.tx, letterSpacing: "-0.4px", marginBottom: 16 }}>
            Bonjour, {athleteProfile?.first_name ?? athleteProfile?.full_name?.split(" ")[0] ?? "athlete"} 👋
          </div>

          {readiness ? (
            <div
              style={{
                background: C.s1, borderRadius: 20, padding: 16,
                border: "1px solid " + C.brd,
                display: "flex", alignItems: "center", gap: 20,
              }}
            >
              <ReadinessCircle score={readiness.score} color={readiness.color} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: readiness.color, marginBottom: 4 }}>
                  {readiness.label}
                </div>
                <div style={{ fontSize: 11, color: C.tx3, marginBottom: 12 }}>Readiness du jour</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {WELL_FIELDS.map((f) => {
                    const v = (wellness as Record<string, number> | null)?.[f.key as string];
                    if (v == null) return null;
                    return (
                      <div key={f.key as string} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10 }}>{f.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{v}</div>
                        <div style={{ fontSize: 8, color: C.tx3 }}>{f.label.slice(0, 3)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowWellness(true); haptic(); }}
              style={{
                width: "100%", padding: "16px", borderRadius: 20,
                border: "1.5px dashed " + C.coach + "60", background: C.coachS,
                color: C.coach, fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", minHeight: 44,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span>❤️</span> Logger mon wellness du jour
            </button>
          )}

          {readiness && (
            <button
              onClick={() => { setShowWellness(true); haptic(); }}
              style={{
                marginTop: 8, fontSize: 11, color: C.tx3,
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "inherit", padding: 0, textDecoration: "underline",
              }}
            >
              Modifier
            </button>
          )}
        </div>

        {/* Section 2 — Séance du jour */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
            Séance du jour
          </div>

          {restDay && todayTests.length === 0 ? (
            <div style={{ background: C.s1, borderRadius: 16, padding: 16, border: "1px solid " + C.brd, textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>😌</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.tx }}>Jour de repos</div>
              <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>Profitez pour récupérer !</div>
            </div>
          ) : allDoneToday ? (
            <div style={{ background: C.s1, borderRadius: 16, padding: 16, border: "1px solid #22C99340" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#22C99320", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✓</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#22C993" }}>Séance complétée !</div>
              </div>
              <button
                onClick={() => { navigate("/athlete/log"); haptic(); }}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 12,
                  border: "1px solid #22C99340", background: "rgba(34,201,147,0.08)",
                  color: "#22C993", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", minHeight: 44,
                }}
              >
                Voir les détails →
              </button>
            </div>
          ) : nextWorkout ? (
            <div style={{ background: C.s1, borderRadius: 16, padding: 16, border: "1px solid " + C.coach + "40" }}>
              <div style={{ fontSize: 12, color: C.tx3, marginBottom: 4 }}>
                {nextWorkout.session.short}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.tx, marginBottom: 4 }}>
                {nextWorkout.session.name}
              </div>
              <div style={{ fontSize: 11, color: C.tx3, marginBottom: 14 }}>
                {nextWorkout.exercises.length} exercice{nextWorkout.exercises.length > 1 ? "s" : ""}
              </div>
              <button
                onClick={() => {
                  haptic();
                  navigate("/athlete/log", { state: { initialSess: nextWorkout.session } });
                }}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 14,
                  border: "none", background: C.coach, color: "#fff",
                  fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  minHeight: 44,
                }}
              >
                Démarrer la séance ▶
              </button>
            </div>
          ) : (
            <div style={{ background: C.s1, borderRadius: 16, padding: 16, border: "1px solid " + C.brd, textAlign: "center", color: C.tx3, fontSize: 12 }}>
              Aucune séance planifiée aujourd'hui
            </div>
          )}

          {/* Tests du jour */}
          {todayTests.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {todayTests.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: C.s1, borderRadius: 14, padding: "12px 14px",
                    border: "1px solid " + (t.completed ? "#22C99330" : C.ac + "30"),
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: t.completed ? "#22C99318" : C.acS,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18,
                    }}
                  >
                    🧪
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: 10, color: C.tx3, marginTop: 1 }}>
                      {t.type}{t.completed ? " · Complété ✓" : " · À faire"}
                    </div>
                  </div>
                  {t.completed && (
                    <span style={{ fontSize: 16, color: "#22C993" }}>✓</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3 — Planning semaine horizontal */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
            Cette semaine
          </div>
          <div
            style={{
              display: "flex", gap: 6,
              overflowX: "auto", scrollbarWidth: "none",
              paddingBottom: 2,
            }}
          >
            {weekDays.map((day) => {
              const isToday = day.date === today;
              const hasSess = day.sessions.length > 0;
              const hasTest = day.tests.length > 0;
              const allDone = hasSess && day.sessions.every(s => s.isCompleted);
              const DOW_SHORT = ["L", "M", "M", "J", "V", "S", "D"];
              return (
                <button
                  key={day.date}
                  onClick={() => { setSelectedDay(day); haptic(); }}
                  style={{
                    flex: "1 0 0",
                    minWidth: 40,
                    padding: "8px 4px",
                    borderRadius: 12,
                    border: "1px solid " + (isToday ? C.coach + "60" : C.brd),
                    background: isToday ? C.coachS : C.s1,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}
                >
                  {/* Day letter */}
                  <div style={{ fontSize: 9, fontWeight: 600, color: isToday ? C.coach : C.tx3 }}>
                    {DOW_SHORT[day.dow]}
                  </div>
                  {/* Date number */}
                  <div
                    style={{
                      width: 26, height: 26, borderRadius: "50%",
                      background: isToday ? C.coach : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                      color: isToday ? "#fff" : (hasSess || hasTest) ? C.tx : C.tx3,
                    }}
                  >
                    {new Date(day.date + "T12:00:00").getDate()}
                  </div>
                  {/* Dots: sessions + tests */}
                  <div style={{ display: "flex", gap: 3, height: 6, alignItems: "center" }}>
                    {day.sessions.map((s) => (
                      <div
                        key={s.session.id}
                        style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: s.isCompleted ? "#22C993" : C.coach,
                        }}
                      />
                    ))}
                    {day.tests.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: t.completed ? "#22C993" : C.ac,
                        }}
                      />
                    ))}
                  </div>
                  {/* "Repos" label or done check */}
                  {allDone ? (
                    <div style={{ fontSize: 8, color: "#22C993", fontWeight: 700 }}>✓</div>
                  ) : !hasSess && !hasTest ? (
                    <div style={{ fontSize: 8, color: C.tx3 }}>—</div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 4 — Récap hier */}
        {(yesterdayWellness || yesterdaySessName) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              Hier
            </div>
            <div
              style={{
                background: C.s1, borderRadius: 14, padding: "12px 16px",
                border: "1px solid " + C.brd,
                display: "flex", alignItems: "center", gap: 16,
              }}
            >
              {yesterdaySessName && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>✅</span>
                  <div>
                    <div style={{ fontSize: 10, color: C.tx3 }}>Séance</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.tx }}>{yesterdaySessName}</div>
                  </div>
                </div>
              )}
              {yesterdayWellness?.score != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>❤️</span>
                  <div>
                    <div style={{ fontSize: 10, color: C.tx3 }}>Wellness</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.tx }}>{yesterdayWellness.score}/100</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 4 — Prochaine compétition */}
        {nextComp && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              Prochaine compétition
            </div>
            <div
              style={{
                background: C.s1, borderRadius: 16, padding: 16,
                border: "1px solid " + C.coach + "40",
                display: "flex", alignItems: "center", gap: 14,
              }}
            >
              <div style={{ fontSize: 28 }}>{COMPETITION_META[nextComp.type]?.emoji ?? "🏆"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{nextComp.name}</div>
                  <span
                    style={{
                      fontSize: 9, fontWeight: 700,
                      padding: "2px 7px", borderRadius: 20,
                      background: nextComp.priority === "A" ? C.coachS : C.oS,
                      color: nextComp.priority === "A" ? C.coach : C.o,
                    }}
                  >
                    {nextComp.priority}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.tx3 }}>
                  J-{nextComp.daysUntil} · {nextComp.date}
                  {nextComp.location ? ` · ${nextComp.location}` : ""}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 5 — Tendance de forme */}
        {wellnessTrendHasData && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Tendance de forme
              </div>
              <button
                onClick={() => navigate("profil")}
                style={{ fontSize: 10, color: C.ac, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
              >
                Historique →
              </button>
            </div>

            {/* Score + graph */}
            <div style={{ background: C.s1, borderRadius: 16, padding: "14px 16px", border: "1px solid " + C.brd, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.tx3, marginBottom: 2 }}>Forme moyenne · 7j</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: formeColor }}>
                    {avgFormeScore ?? "—"}
                    {avgFormeScore != null && <span style={{ fontSize: 12, fontWeight: 400, color: C.tx3 }}>/100</span>}
                  </div>
                </div>
                <div
                  style={{
                    padding: "5px 12px", borderRadius: 20,
                    background: formeColor + "18", border: "1px solid " + formeColor + "40",
                    fontSize: 12, fontWeight: 700, color: formeColor,
                  }}
                >
                  {formeLabel}
                </div>
              </div>

              {/* 14-day line chart */}
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={wellnessTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <ReferenceLine y={60} stroke={C.brd} strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={formeColor}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <XAxis
                    dataKey="d"
                    tick={{ fontSize: 9, fill: C.tx3 }}
                    axisLine={false} tickLine={false}
                    interval={3}
                  />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip
                    contentStyle={{ background: C.s1, border: "none", borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: C.tx3 }}
                    formatter={(v: number) => [`${v}/100`, "Forme"]}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Advice cards */}
            {formeAdvice.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {formeAdvice.map((tip) => (
                  <div
                    key={tip.label}
                    style={{
                      background: C.s1, borderRadius: 12, padding: "12px 14px",
                      border: "1px solid " + tip.color + "30",
                      display: "flex", gap: 12, alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: tip.color + "15",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18,
                      }}
                    >
                      {tip.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: tip.color, marginBottom: 3 }}>
                        {tip.label}
                      </div>
                      <div style={{ fontSize: 11, color: C.tx2, lineHeight: 1.4 }}>{tip.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formeAdvice.length === 0 && avgFormeScore != null && avgFormeScore >= 70 && (
              <div
                style={{
                  background: C.gS, borderRadius: 12, padding: "12px 14px",
                  border: "1px solid " + C.g + "30",
                  display: "flex", gap: 10, alignItems: "center",
                }}
              >
                <span style={{ fontSize: 20 }}>💚</span>
                <div style={{ fontSize: 11, color: C.tx2, lineHeight: 1.4 }}>
                  Ton état de forme est bon. Continue sur ta lancée et maintiens tes bonnes habitudes !
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Day preview BottomSheet */}
      <DayPreviewSheet
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
        onStartSession={(sess) => navigate("/athlete/log", { state: { initialSess: sess } })}
      />
    </>
  );
}
