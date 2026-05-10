import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useTodayWellness } from "@/features/shared/hooks/useTodayWellness";
import { useReadinessScore } from "@/features/shared/hooks/useReadinessScore";
import { useUpcomingCompetition } from "@/features/shared/hooks/useUpcomingCompetition";
import { useWeekProgram } from "@/features/shared/hooks/useWeekProgram";
import { useActivePlan } from "@/features/shared/hooks/useActivePlan";
import { useStartUnplannedSession } from "@/features/shared/hooks/useStartUnplannedSession";
import { useUnifiedCalendar } from "@/features/shared/hooks/useUnifiedCalendar";
import type { UnifiedCalendarEvent } from "@/features/shared/hooks/useUnifiedCalendar";
import { useEnergySession } from "@/features/shared/hooks/useEnergySessions";
import { SessionPreviewModal } from "@/features/coach/components/energy/SessionPreviewModal";
import { TestFillDrawer } from "@/features/athlete/components/TestFillDrawer";
import { useCompetitions } from "@/hooks/useCompetitions";
import { COMPETITION_META } from "@/types/planning";
import { AthleteCompetitionCard } from "@/features/athlete/components/AthleteCompetitionCard";
import type { DayProgram } from "@/features/shared/hooks/useWeekProgram";
import type { WeekSession } from "@/features/shared/hooks/useActivePlan";
import type { FreeSession } from "@/features/shared/types/athlete";

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

// ── Sports list ───────────────────────────────────────────────────────────────

const SPORTS = [
  { key: "course",    emoji: "🏃", label: "Course"       },
  { key: "velo",      emoji: "🚴", label: "Vélo"         },
  { key: "natation",  emoji: "🏊", label: "Natation"     },
  { key: "muscu",     emoji: "💪", label: "Muscu"        },
  { key: "marche",    emoji: "🚶", label: "Marche"       },
  { key: "yoga",      emoji: "🧘", label: "Yoga"         },
  { key: "football",  emoji: "⚽", label: "Football"     },
  { key: "tennis",    emoji: "🎾", label: "Tennis"       },
  { key: "boxe",      emoji: "🥊", label: "Boxe"         },
  { key: "escalade",  emoji: "🧗", label: "Escalade"     },
  { key: "ski",       emoji: "⛷️", label: "Ski"          },
  { key: "autre",     emoji: "🏅", label: "Autre"        },
];

// ── Free activity modal ───────────────────────────────────────────────────────

interface FreeActivityModalProps {
  date: string | null;
  existing?: FreeSession | null;
  onClose: () => void;
  onSave: (session: FreeSession) => void;
  onDelete?: (id: string) => void;
}

function FreeActivityModal({ date, existing, onClose, onSave, onDelete }: FreeActivityModalProps) {
  const isEdit = !!existing;
  const [sport, setSport] = useState(SPORTS[0]);
  const [customLabel, setCustomLabel] = useState("");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState(5);
  const [note, setNote] = useState("");
  const labelRef = useRef<HTMLInputElement>(null);

  // Pre-fill when editing
  useEffect(() => {
    if (existing) {
      const found = SPORTS.find((s) => s.key === existing.sport) ?? SPORTS[SPORTS.length - 1];
      setSport(found);
      setCustomLabel(found.key === "autre" ? existing.name : "");
      setDuration(existing.duration?.toString() ?? "");
      setIntensity(existing.intensity ?? 5);
      setNote(existing.note ?? "");
    } else {
      setSport(SPORTS[0]);
      setCustomLabel("");
      setDuration("");
      setIntensity(5);
      setNote("");
    }
  }, [existing, date]);

  const open = !!date;
  const activeDate = date ?? existing?.date ?? "";
  const d = activeDate ? new Date(activeDate + "T12:00:00") : new Date();
  const dateLabel = activeDate
    ? `${DAYS_FULL_FR[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
    : "";

  function handleSave() {
    const name = sport.key === "autre" && customLabel.trim() ? customLabel.trim() : sport.label;
    onSave({
      ...(isEdit ? existing : {}),
      id: existing?.id ?? "free_" + Date.now(),
      name,
      sport: sport.key,
      sportEmoji: sport.emoji,
      date: activeDate,
      duration: parseInt(duration) || undefined,
      intensity,
      note: note.trim() || undefined,
      completed: true,
      exercises: existing?.exercises ?? [],
    });
    onClose();
  }

  const intensityColor = intensity <= 3 ? C.g : intensity <= 6 ? C.o : C.r;

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent style={{ background: C.s1, borderTop: "1px solid " + C.brd, padding: "0 0 32px" }}>
        <DrawerHeader style={{ padding: "16px 20px 12px", display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <DrawerTitle style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>
              {isEdit ? "Modifier l'activité" : "Activité libre"}
              {dateLabel ? <span style={{ fontSize: 13, fontWeight: 400, color: C.tx3, marginLeft: 8 }}>{dateLabel}</span> : null}
            </DrawerTitle>
          </div>
          {isEdit && onDelete && existing && (
            <button
              onClick={() => { onDelete(existing.id); onClose(); }}
              style={{
                padding: "5px 12px", borderRadius: 8,
                border: "1px solid " + C.r + "50", background: "rgba(239,75,75,0.08)",
                color: C.r, fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Supprimer
            </button>
          )}
        </DrawerHeader>

        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Sport picker */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
              Sport
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
              {SPORTS.map((s) => {
                const active = sport.key === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => { setSport(s); if (s.key === "autre") setTimeout(() => labelRef.current?.focus(), 50); }}
                    style={{
                      flexShrink: 0, padding: "8px 12px", borderRadius: 10,
                      border: "1px solid " + (active ? C.ac + "80" : C.brd),
                      background: active ? C.acS : C.s2,
                      cursor: "pointer", fontFamily: "inherit",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                      minWidth: 52,
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{s.emoji}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: active ? C.ac : C.tx3 }}>{s.label}</span>
                  </button>
                );
              })}
            </div>
            {sport.key === "autre" && (
              <input
                ref={labelRef}
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Nom de l'activité…"
                style={{
                  marginTop: 8, width: "100%", padding: "9px 12px",
                  borderRadius: 8, border: "1px solid " + C.brdL,
                  background: C.s2, color: C.tx, fontSize: 13,
                  fontFamily: "inherit", boxSizing: "border-box" as const, outline: "none",
                }}
              />
            )}
          </div>

          {/* Duration + intensity */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                Durée (min)
              </div>
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="ex: 45"
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 8,
                  border: "1px solid " + C.brdL, background: C.s2,
                  color: C.tx, fontSize: 14, fontWeight: 700,
                  fontFamily: "inherit", boxSizing: "border-box" as const, outline: "none",
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                Intensité — <span style={{ color: intensityColor, fontWeight: 700 }}>{intensity}/10</span>
              </div>
              <input
                type="range"
                min={1} max={10} value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                style={{ width: "100%", accentColor: intensityColor, marginTop: 6 }}
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
              Note (optionnel)
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Comment tu t'es senti…"
              rows={2}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8,
                border: "1px solid " + C.brdL, background: C.s2,
                color: C.tx, fontSize: 13, fontFamily: "inherit",
                resize: "none", outline: "none", boxSizing: "border-box" as const,
              }}
            />
          </div>

          <button
            onClick={handleSave}
            style={{
              width: "100%", padding: "13px 0", borderRadius: 12,
              border: "none", background: C.ac, color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", minHeight: 44,
            }}
          >
            {isEdit ? "Enregistrer les modifications ✓" : "Enregistrer ✓"}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ── Day preview bottom sheet ──────────────────────────────────────────────────

const DAYS_FULL_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface DayPreviewSheetProps {
  day: DayProgram | null;
  onClose: () => void;
  onStartSession: (sess: DayProgram["sessions"][number]["session"]) => void;
  freeSessions: FreeSession[];
  energyByDate: Map<string, UnifiedCalendarEvent[]>;
  onEnergyPreview: (ev: UnifiedCalendarEvent) => void;
  onAddActivity: (date: string) => void;
  onEditActivity: (session: FreeSession) => void;
  onTestPress: (id: string) => void;
}

function DayPreviewSheet({ day, onClose, onStartSession, freeSessions, energyByDate, onEnergyPreview, onAddActivity, onEditActivity, onTestPress }: DayPreviewSheetProps) {
  if (!day) return null;
  const date = new Date(day.date + "T12:00:00");
  const dateLabel = `${DAYS_FULL_FR[day.dow]} ${date.getDate()} ${MONTHS_FR[date.getMonth()]}`;
  const isToday = day.date === new Date().toISOString().split("T")[0];
  const isPast  = day.date < new Date().toISOString().split("T")[0];
  const isFuture = day.date > new Date().toISOString().split("T")[0];
  const dayEnergySessions = energyByDate.get(day.date) ?? [];
  const empty   = day.sessions.length === 0 && day.tests.length === 0 && dayEnergySessions.length === 0;
  const dayFreeActivities = freeSessions.filter((f) => f.date === day.date && f.sport);

  const ENERGY_KIND_COLOR: Record<string, string> = {
    vo2: "#A855F7", tempo: "#3B8DF0", seuil: "#F59E0B",
    footing: "#10B981", fartlek: "#EF4444", autre: "#6B7280", custom: "#6B7280",
  };
  const ENERGY_KIND_LABEL: Record<string, string> = {
    vo2: "VO₂", tempo: "Tempo", seuil: "Seuil",
    footing: "Footing", fartlek: "Fartlek", autre: "Autre", custom: "Custom",
  };

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

              {/* Séances énergie */}
              {dayEnergySessions.map((ev) => {
                const kc = ENERGY_KIND_COLOR[ev.sessionKind ?? ""] ?? "#A855F7";
                const kl = ENERGY_KIND_LABEL[ev.sessionKind ?? ""] ?? ev.sessionKind ?? "Énergie";
                const isDone = ev.status === "completed";
                return (
                  <button
                    key={ev.id}
                    onClick={() => { onEnergyPreview(ev); onClose(); haptic(); }}
                    style={{
                      width: "100%", background: isDone ? C.gS : kc + "12",
                      borderRadius: 14, padding: "14px 16px",
                      border: "1px solid " + (isDone ? C.g + "40" : kc + "40"),
                      display: "flex", alignItems: "center", gap: 12,
                      cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const,
                    }}
                  >
                    <div style={{ fontSize: 24 }}>🏃</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{ev.title}</div>
                      <div style={{ fontSize: 10, marginTop: 2, fontWeight: 600, color: kc }}>
                        {kl} · {isDone ? "Complétée ✓" : isPast ? "Manquée" : "À faire"}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: C.tx3 }}>Voir →</span>
                  </button>
                );
              })}

              {/* Tests */}
              {day.tests.map((t) => {
                const tc = t.type === "musculation" ? "#7B6FFF"
                  : t.type === "energetique" ? "#EF4B4B"
                  : t.type === "specifique" ? "#F5A623"
                  : "#22C993";
                return (
                  <button
                    key={t.id}
                    onClick={() => { onTestPress(t.id); onClose(); haptic(); }}
                    style={{
                      width: "100%", background: t.completed ? C.gS : tc + "12",
                      borderRadius: 14, padding: "14px 16px",
                      border: "1px solid " + (t.completed ? C.g + "40" : tc + "40"),
                      display: "flex", alignItems: "center", gap: 12,
                      cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const,
                    }}
                  >
                    <div style={{ fontSize: 24 }}>🧪</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{t.title}</div>
                      <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>
                        {t.type} · {t.completed ? "Réalisé ✓" : "À faire"}
                      </div>
                    </div>
                    {t.completed
                      ? <span style={{ fontSize: 18, color: C.g }}>✓</span>
                      : <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: tc + "20", color: tc, flexShrink: 0 }}>Remplir →</span>
                    }
                  </button>
                );
              })}
            </>
          )}

          {/* Free activities logged for this day */}
          {dayFreeActivities.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: empty ? 0 : 4 }}>
              {dayFreeActivities.map((f) => {
                const intColor = f.intensity != null
                  ? (f.intensity <= 3 ? C.g : f.intensity <= 6 ? C.o : C.r)
                  : C.tx3;
                return (
                  <button
                    key={f.id}
                    onClick={() => { onEditActivity(f); onClose(); haptic(); }}
                    style={{
                      width: "100%", background: C.gS, borderRadius: 14, padding: "12px 14px",
                      border: "1px solid " + C.g + "40",
                      display: "flex", alignItems: "center", gap: 12,
                      cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const,
                    }}
                  >
                    <div style={{ fontSize: 24 }}>{f.sportEmoji ?? "🏅"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{f.name}</div>
                      <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>
                        {f.duration ? `${f.duration} min` : ""}
                        {f.duration && f.intensity != null ? " · " : ""}
                        {f.intensity != null ? <span style={{ color: intColor }}>Intensité {f.intensity}/10</span> : null}
                        {f.note ? ` · "${f.note}"` : ""}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: C.tx3 }}>✎</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Add free activity button (today + past only) */}
          {!isFuture && (
            <button
              onClick={() => { onAddActivity(day.date); onClose(); haptic(); }}
              style={{
                width: "100%", padding: "11px 0", borderRadius: 10,
                border: "1px dashed " + C.brdL, background: "transparent",
                color: C.tx3, fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                marginTop: (empty && dayFreeActivities.length === 0) ? 0 : 4,
              }}
            >
              + Activité libre
            </button>
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

// ── Energy preview overlay (reuse coach SessionPreviewModal) ─────────────────

function EnergyPreviewOverlay({
  event,
  athleteId,
  onClose,
}: {
  event: UnifiedCalendarEvent;
  athleteId: string;
  onClose: () => void;
}) {
  const sessionId = event.energySessionId ?? (event.raw?.energy_session_id as string | undefined);
  const { data: session, isLoading } = useEnergySession(sessionId);

  if (isLoading) {
    return (
      <>
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.65)" }} />
        <div style={{
          position: "fixed", top: "50%", left: "50%", zIndex: 61,
          transform: "translate(-50%, -50%)",
          width: 420, maxWidth: "96vw",
          background: C.s1, borderRadius: 16, border: "1px solid " + C.brd,
          padding: "40px", textAlign: "center", color: C.tx3, fontSize: 13,
        }}>
          Chargement…
        </div>
      </>
    );
  }
  if (!session) return null;
  return <SessionPreviewModal session={session} athleteId={athleteId} onClose={onClose} />;
}

// ── Main page ─────────────────────────────────────────────────────────────────

function localMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function TodayPage() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState<DayProgram | null>(null);
  const [activityDate, setActivityDate] = useState<string | null>(null);
  const [editActivity, setEditActivity] = useState<FreeSession | null>(null);
  const [energyPreview, setEnergyPreview] = useState<UnifiedCalendarEvent | null>(null);
  const [showOtherSessions, setShowOtherSessions] = useState(false);
  const [testPreviewId, setTestPreviewId] = useState<string | null>(null);

  const {
    athleteId, athleteProfile, wellnessHistory,
    setShowWellness, freeSessions, setFreeSessions,
    athleteProfile: profile,
  } = useAthleteContext();

  const wellness        = useTodayWellness();
  const readiness       = useReadinessScore(wellness);
  const { data: nextComp } = useUpcomingCompetition(athleteId);
  const { data: allCompetitions = [] } = useCompetitions(athleteId);
  const weekDays = useWeekProgram(null);

  // Active plan (new system) for other sessions + unplanned session start
  const { data: activePlanData } = useActivePlan(athleteId ?? "");
  const { mutate: startUnplanned, isPending: startingUnplanned } = useStartUnplannedSession();
  const weekMondayISO = useMemo(localMonday, []);
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();

  // Week ISO range for current week (same logic as useWeekProgram)
  const { mondayISO, sundayISO } = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setHours(0, 0, 0, 0);
    const mon = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const sun = new Date(d);
    sun.setDate(d.getDate() + 6);
    return {
      mondayISO: mon,
      sundayISO: `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, "0")}-${String(sun.getDate()).padStart(2, "0")}`,
    };
  }, []);

  const { data: calEvents = [] } = useUnifiedCalendar(
    athleteId ?? "",
    { start: mondayISO, end: sundayISO },
  );

  const energyByDate = useMemo(() => {
    const m = new Map<string, UnifiedCalendarEvent[]>();
    for (const ev of calEvents) {
      if (ev.type === "energy") {
        const arr = m.get(ev.date) ?? [];
        arr.push(ev);
        m.set(ev.date, arr);
      }
    }
    return m;
  }, [calEvents]);

  const todayEnergySessions = energyByDate.get(today) ?? [];

  // Derive today's workouts from the date-based week schedule
  const todayDay = weekDays.find((d) => d.date === today);
  const workouts = todayDay?.sessions ?? [];
  const todayTests = todayDay?.tests ?? [];
  const nextWorkout = workouts.find((w) => !w.isCompleted) ?? null;
  const allDoneToday = workouts.length > 0 && workouts.every((w) => w.isCompleted);
  const restDay = workouts.length === 0 && todayEnergySessions.length === 0;

  // ── Séances non complétées de la semaine (hors aujourd'hui) ──────────────
  const otherUndoneSessions = useMemo((): WeekSession[] => {
    if (!activePlanData?.weekDays) return [];
    return activePlanData.weekDays.flatMap((d) => {
      if (d.date === today) return [];
      return d.sessions.filter(
        (s) => s.kind === "workout" && s.status !== "completed" && s.status !== "skipped"
      );
    });
  }, [activePlanData, today]);

  // Badge "2 séances aujourd'hui" : si activePlan a plusieurs workout sessions aujourd'hui
  const todayActivePlanSessions = useMemo((): WeekSession[] => {
    return activePlanData?.weekDays
      .find((d) => d.date === today)
      ?.sessions.filter((s) => s.kind === "workout") ?? [];
  }, [activePlanData, today]);
  const hasTwoSessionsToday = todayActivePlanSessions.length >= 2;

  // ── Coach id (for unplanned session insert) ───────────────────────────────
  // Not directly in AthleteContext — we extract from first workout_log if available
  const coachIdForUnplanned = activePlanData?.weekDays
    .flatMap((d) => d.sessions)
    .find((s) => s.kind === "workout")
    ?.id ? null : null; // No coach_id available in WeekSession — use null

  // ── Compétitions passées sans commentaire (7 derniers jours) ─────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const uncommentedComps = allCompetitions.filter(
    (c) => c.date < today && c.date >= sevenDaysAgo && !c.athlete_comment
  );

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
        {(() => {
          const EKC: Record<string, string> = { vo2: "#A855F7", tempo: "#3B8DF0", seuil: "#F59E0B", footing: "#10B981", fartlek: "#EF4444", autre: "#6B7280", custom: "#6B7280" };
          const EKL: Record<string, string> = { vo2: "VO₂", tempo: "Tempo", seuil: "Seuil", footing: "Footing", fartlek: "Fartlek", autre: "Autre", custom: "Custom" };

          const pendingWorkouts = workouts.filter(w => !w.isCompleted);
          const pendingEnergy   = todayEnergySessions.filter(ev => ev.status !== "completed");
          const pendingTests    = todayTests.filter(t => !t.completed);
          const totalToday      = workouts.length + todayEnergySessions.length + todayTests.length;
          const hasPending      = pendingWorkouts.length > 0 || pendingEnergy.length > 0 || pendingTests.length > 0;

          return (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
                Séance du jour
              </div>

              {totalToday === 0 ? (
                /* ── Repos ── */
                <div style={{ background: C.s1, borderRadius: 16, padding: "18px 16px", border: "1px solid " + C.brd, textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>😌</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>Récupération</div>
                  <div style={{ fontSize: 11, color: C.tx3, marginTop: 3 }}>Rien de prévu — profite pour te reposer !</div>
                </div>

              ) : !hasPending ? (
                /* ── Tout terminé ── */
                <div style={{ background: C.gS, borderRadius: 16, padding: "18px 16px", border: "1px solid " + C.g + "40", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.g }}>
                    {totalToday > 1 ? "Séances terminées !" : "Séance terminée !"}
                  </div>
                  <div style={{ fontSize: 11, color: C.tx3, marginTop: 4 }}>Bien joué, récupère bien 💪</div>
                </div>

              ) : (
                /* ── Items à faire ── */
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Workouts en attente */}
                  {pendingWorkouts.map((w) => (
                    <div key={w.session.id} style={{ background: C.s1, borderRadius: 16, padding: 16, border: "1px solid " + C.coach + "40" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: C.coachS, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                          🏋️
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.session.name}</div>
                          <div style={{ fontSize: 10, color: C.tx3, marginTop: 1 }}>
                            Musculation · {w.exercises.length} exercice{w.exercises.length > 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => { haptic(); navigate("/athlete/log", { state: { initialSess: w.session } }); }}
                        style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.coach, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 44 }}
                      >
                        Démarrer ▶
                      </button>
                    </div>
                  ))}

                  {/* Energy en attente */}
                  {pendingEnergy.map((ev) => {
                    const kc = EKC[ev.sessionKind ?? ""] ?? "#A855F7";
                    const kl = EKL[ev.sessionKind ?? ""] ?? ev.sessionKind ?? "Énergie";
                    return (
                      <button
                        key={ev.id}
                        onClick={() => { setEnergyPreview(ev); haptic(); }}
                        style={{ width: "100%", background: kc + "12", borderRadius: 14, padding: "14px 16px", border: "1px solid " + kc + "40", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: kc + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏃</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                          <div style={{ fontSize: 10, color: kc, marginTop: 1, fontWeight: 600 }}>{kl}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: kc + "20", color: kc, flexShrink: 0 }}>Voir →</span>
                      </button>
                    );
                  })}

                  {/* Tests en attente */}
                  {pendingTests.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setTestPreviewId(t.id); haptic(); }}
                      style={{ width: "100%", background: C.acS, borderRadius: 14, padding: "14px 16px", border: "1px solid " + C.ac + "40", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: C.acS, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧪</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                        <div style={{ fontSize: 10, color: C.tx3, marginTop: 1, textTransform: "capitalize" }}>{t.type} · Test</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: C.ac + "20", color: C.ac, flexShrink: 0 }}>Remplir →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Section 2b — Badge 2 séances aujourd'hui */}
        {hasTwoSessionsToday && (
          <div style={{
            marginBottom: 12, padding: "8px 14px", borderRadius: 10,
            background: "rgba(59,141,240,0.1)", border: "1px solid rgba(59,141,240,0.3)",
            fontSize: 12, fontWeight: 600, color: "#3B8DF0",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            ℹ️ {todayActivePlanSessions.length} séances prévues aujourd'hui
          </div>
        )}

        {/* Section 2c — Faire une autre séance */}
        {(allDoneToday || restDay) && otherUndoneSessions.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => { setShowOtherSessions((v) => !v); haptic(); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 12,
                border: "1px dashed " + C.brdL, background: C.s1,
                color: C.tx3, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit", minHeight: 44,
              }}
            >
              <span>💪 Faire une autre séance cette semaine</span>
              <span style={{ fontSize: 10 }}>{showOtherSessions ? "▲" : "▼"}</span>
            </button>

            {showOtherSessions && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {otherUndoneSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      haptic();
                      if (!athleteId) return;
                      // Create unplanned workout_log then navigate
                      startUnplanned(
                        {
                          athleteId,
                          coachId:        null,
                          sessionId:      s.sessionId ?? s.id,
                          sessionName:    s.sessionName,
                          scheduledDate:  today,
                          weekMondayISO,
                        },
                        {
                          onSuccess: () => {
                            navigate("/athlete/log", {
                              state: {
                                initialSess: {
                                  id:          s.sessionId ?? s.id,
                                  name:        s.sessionName,
                                  short:       s.sessionName.slice(0, 3).toUpperCase(),
                                  day_of_week: (new Date(s.scheduledDate + "T12:00:00").getDay() + 6) % 7,
                                },
                              },
                            });
                          },
                        }
                      );
                    }}
                    disabled={startingUnplanned}
                    style={{
                      width: "100%", padding: "12px 14px", borderRadius: 12,
                      border: "1px solid " + C.coach + "40", background: C.coachS,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{s.sessionName}</div>
                      <div style={{ fontSize: 10, color: C.tx3, marginTop: 1 }}>
                        Planifiée {new Date(s.scheduledDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long" })}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.coach }}>
                      Démarrer ▶
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
              const dayEnergy = energyByDate.get(day.date) ?? [];
              const dayFree = freeSessions.filter((f) => f.date === day.date && f.sport);
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
                      color: isToday ? "#fff" : (hasSess || hasTest || dayEnergy.length > 0 || dayFree.length > 0) ? C.tx : C.tx3,
                    }}
                  >
                    {new Date(day.date + "T12:00:00").getDate()}
                  </div>
                  {/* Dots: sessions + energy + tests + free activities */}
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
                    {dayEnergy.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: ev.status === "completed" ? "#22C993" : "#A855F7",
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
                    {dayFree.map((f) => (
                      <div
                        key={f.id}
                        style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: "#22C993",
                        }}
                      />
                    ))}
                  </div>
                  {/* "Repos" label or done check */}
                  {allDone ? (
                    <div style={{ fontSize: 8, color: "#22C993", fontWeight: 700 }}>✓</div>
                  ) : !hasSess && !hasTest && dayFree.length === 0 ? (
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

        {/* Section 4b — Compétitions passées à commenter */}
        {uncommentedComps.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              Compétitions passées à commenter
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {uncommentedComps.map((comp) => (
                <AthleteCompetitionCard
                  key={comp.id}
                  competition={{
                    id: comp.id,
                    name: comp.name,
                    type: comp.type,
                    date: comp.date,
                    location: comp.location,
                    athlete_comment: comp.athlete_comment ?? null,
                    priority: comp.priority,
                  }}
                />
              ))}
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
        freeSessions={freeSessions}
        energyByDate={energyByDate}
        onEnergyPreview={(ev) => setEnergyPreview(ev)}
        onAddActivity={(date) => setActivityDate(date)}
        onEditActivity={(f) => setEditActivity(f)}
        onTestPress={(id) => setTestPreviewId(id)}
      />

      {/* Energy session preview overlay */}
      {energyPreview && (
        <EnergyPreviewOverlay
          event={energyPreview}
          athleteId={athleteId ?? ""}
          onClose={() => setEnergyPreview(null)}
        />
      )}

      {/* Free activity create modal */}
      <FreeActivityModal
        date={activityDate}
        onClose={() => setActivityDate(null)}
        onSave={(session) => setFreeSessions((prev) => [...prev, session])}
      />

      {/* Free activity edit modal */}
      <FreeActivityModal
        date={editActivity?.date ?? null}
        existing={editActivity}
        onClose={() => setEditActivity(null)}
        onSave={(session) => setFreeSessions((prev) => prev.map((f) => f.id === session.id ? session : f))}
        onDelete={(id) => setFreeSessions((prev) => prev.filter((f) => f.id !== id))}
      />

      {/* Test preview / fill drawer */}
      <TestFillDrawer
        testId={testPreviewId}
        athleteId={athleteId ?? ""}
        onClose={() => setTestPreviewId(null)}
      />
    </>
  );
}
