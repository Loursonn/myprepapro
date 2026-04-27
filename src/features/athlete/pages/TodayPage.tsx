import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { C } from "@/lib/theme";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import { useTodayWorkout } from "@/features/shared/hooks/useTodayWorkout";
import { useTodayWellness } from "@/features/shared/hooks/useTodayWellness";
import { useReadinessScore } from "@/features/shared/hooks/useReadinessScore";
import { useUpcomingCompetition } from "@/features/shared/hooks/useUpcomingCompetition";
import { useLogWellness } from "@/features/shared/hooks/useLogWellness";
import { COMPETITION_META } from "@/types/planning";
import type { WellnessData } from "@/features/shared/types/athlete";

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
  return (
    <div style={{ position: "relative", width: 136, height: 136, flexShrink: 0 }}>
      <svg width={136} height={136} viewBox="0 0 136 136" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={68} cy={68} r={r} fill="none" stroke="#1A1B22" strokeWidth={10} />
        <circle
          cx={68} cy={68} r={r} fill="none"
          stroke={color} strokeWidth={10}
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
        <div style={{ fontSize: 30, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>/ 100</div>
      </div>
    </div>
  );
}

// ── Wellness BottomSheet ──────────────────────────────────────────────────────

const WELL_FIELDS: Array<{ key: keyof WellnessData; label: string; icon: string; inv?: boolean }> = [
  { key: "fatigue", label: "Fatigue",  icon: "😴", inv: true },
  { key: "sommeil", label: "Sommeil",  icon: "🌙"              },
  { key: "stress",  label: "Stress",   icon: "😰", inv: true   },
  { key: "energie", label: "Énergie",  icon: "⚡"              },
  { key: "doms",    label: "DOMS",     icon: "💪", inv: true   },
];

interface WellnessSheetProps {
  open: boolean;
  onClose: () => void;
  existing: WellnessData | null;
  onSave: (d: WellnessData) => void;
}

function WellnessSheet({ open, onClose, existing, onSave }: WellnessSheetProps) {
  const [vals, setVals] = useState<Record<string, number>>(() => ({
    fatigue: existing?.fatigue ?? 5,
    sommeil: existing?.sommeil ?? 7,
    stress:  existing?.stress  ?? 4,
    energie: existing?.energie ?? 6,
    doms:    existing?.doms    ?? 3,
  }));

  function handleSubmit() {
    const today = new Date().toISOString().split("T")[0];
    onSave({ ...vals, date: today } as WellnessData);
    haptic();
    onClose();
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent style={{ background: C.s1, borderTop: "1px solid #1A1B22", padding: "0 0 24px" }}>
        <DrawerHeader style={{ padding: "16px 20px 8px" }}>
          <DrawerTitle style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>
            Bilan wellness du jour
          </DrawerTitle>
        </DrawerHeader>

        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 20 }}>
          {WELL_FIELDS.map((f) => {
            const v = vals[f.key as string] as number;
            const inv = f.inv;
            const trackColor = inv
              ? (v >= 7 ? "#EF4B4B" : v <= 3 ? "#22C993" : "#F5A623")
              : (v >= 7 ? "#22C993" : v <= 3 ? "#EF4B4B" : "#F5A623");
            return (
              <div key={f.key as string}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.tx, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{f.icon}</span> {f.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: trackColor, minWidth: 20, textAlign: "right" }}>{v}</div>
                </div>
                <input
                  type="range" min={1} max={10} value={v}
                  onChange={(e) => setVals(prev => ({ ...prev, [f.key as string]: Number(e.target.value) }))}
                  style={{
                    width: "100%", accentColor: trackColor,
                    height: 6, cursor: "pointer",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: C.tx3 }}>1</span>
                  <span style={{ fontSize: 9, color: C.tx3 }}>10</span>
                </div>
              </div>
            );
          })}

          <button
            onClick={handleSubmit}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 14,
              border: "none", background: C.coach, color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              marginTop: 4, minHeight: 44,
            }}
          >
            Enregistrer mon bilan
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const navigate = useNavigate();
  const [wellnessOpen, setWellnessOpen] = useState(false);

  const {
    athleteId, athleteProfile, wellnessHistory, combinedData,
    currentWeek, sessions, exos, completedSessions,
  } = useAthleteContext();

  const wellness        = useTodayWellness();
  const readiness       = useReadinessScore(wellness);
  const { workouts, nextWorkout, allDoneToday } = useTodayWorkout();
  const { data: nextComp } = useUpcomingCompetition(athleteId);
  const { mutate: logWellness } = useLogWellness();

  // ── Yesterday's recap ─────────────────────────────────────────────────────
  const yesterdayISO = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const yesterdayWellness = wellnessHistory?.[yesterdayISO] ?? null;
  const yesterdayDow = (new Date(Date.now() - 86400000).getDay() + 6) % 7;
  const doneLastWeek = new Set<string>();
  const yesterdaySessName = sessions.find(
    (s) => s.day_of_week === yesterdayDow && (exos[s.id] ?? []).length > 0 && doneLastWeek.has(s.id),
  )?.name ?? null;

  // ── Load charge data (last 7 days from combinedData) ─────────────────────
  const chargeData = combinedData?.slice(-7).map((d: { s: string; volProg: number; volReal: number | null }) => ({
    s: d.s,
    vol: d.volReal ?? d.volProg,
  })) ?? [];

  // ── Wellness trend (last 14 days from wellnessHistory) ───────────────────
  const wellnessTrend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000);
    const iso = d.toISOString().split("T")[0];
    const w = wellnessHistory?.[iso];
    return { d: iso.slice(5), score: w?.score ?? null };
  });

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
                background: "#0F1014", borderRadius: 20, padding: 16,
                border: "1px solid #1A1B22",
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
              onClick={() => { setWellnessOpen(true); haptic(); }}
              style={{
                width: "100%", padding: "16px", borderRadius: 20,
                border: "1.5px dashed #D4538E60", background: "rgba(212,83,142,0.06)",
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
              onClick={() => { setWellnessOpen(true); haptic(); }}
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

          {restDay ? (
            <div style={{ background: "#0F1014", borderRadius: 16, padding: 16, border: "1px solid #1A1B22", textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>😌</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.tx }}>Jour de repos</div>
              <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>Profitez pour récupérer !</div>
            </div>
          ) : allDoneToday ? (
            <div style={{ background: "#0F1014", borderRadius: 16, padding: 16, border: "1px solid #22C99340" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#22C99320", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✓</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#22C993" }}>Séance complétée !</div>
              </div>
              <button
                onClick={() => { navigate("program"); haptic(); }}
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
            <div style={{ background: "#0F1014", borderRadius: 16, padding: 16, border: "1px solid #D4538E40" }}>
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
                  navigate(`program/workout/${nextWorkout.session.id}`);
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
            <div style={{ background: "#0F1014", borderRadius: 16, padding: 16, border: "1px solid #1A1B22", textAlign: "center", color: C.tx3, fontSize: 12 }}>
              Aucune séance planifiée aujourd'hui
            </div>
          )}
        </div>

        {/* Section 3 — Récap hier */}
        {(yesterdayWellness || yesterdaySessName) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              Hier
            </div>
            <div
              style={{
                background: "#0F1014", borderRadius: 14, padding: "12px 16px",
                border: "1px solid #1A1B22",
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
                background: "#0F1014", borderRadius: 16, padding: 16,
                border: "1px solid #D4538E40",
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
                      background: nextComp.priority === "A" ? "#D4538E25" : "#F5A62320",
                      color: nextComp.priority === "A" ? "#D4538E" : "#F5A623",
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

        {/* Section 5 — Mini-graphes */}
        {(chargeData.length > 0 || wellnessTrend.some(d => d.score !== null)) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Tendances
              </div>
              <button
                onClick={() => navigate("profil")}
                style={{ fontSize: 10, color: C.ac, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
              >
                Voir plus →
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Charge 7j */}
              {chargeData.length > 0 && (
                <div style={{ background: "#0F1014", borderRadius: 14, padding: "12px 16px", border: "1px solid #1A1B22" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, marginBottom: 8 }}>Charge · 7j</div>
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={chargeData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Bar dataKey="vol" fill={C.ac} radius={[2, 2, 0, 0]} />
                      <XAxis dataKey="s" tick={{ fontSize: 9, fill: C.tx3 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: C.s1, border: "none", borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: C.tx3 }}
                        itemStyle={{ color: C.ac }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Wellness 14j */}
              {wellnessTrend.some(d => d.score !== null) && (
                <div style={{ background: "#0F1014", borderRadius: 14, padding: "12px 16px", border: "1px solid #1A1B22" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.tx3, marginBottom: 8 }}>Wellness · 14j</div>
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={wellnessTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <Line type="monotone" dataKey="score" stroke={C.coach} strokeWidth={2} dot={false} connectNulls />
                      <XAxis dataKey="d" tick={{ fontSize: 9, fill: C.tx3 }} axisLine={false} tickLine={false} interval={3} />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip
                        contentStyle={{ background: C.s1, border: "none", borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: C.tx3 }}
                        itemStyle={{ color: C.coach }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Wellness BottomSheet */}
      <WellnessSheet
        open={wellnessOpen}
        onClose={() => setWellnessOpen(false)}
        existing={wellness}
        onSave={logWellness}
      />
    </>
  );
}
