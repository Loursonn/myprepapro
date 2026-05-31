import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Users, Calendar, FlaskConical, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/features/shared/components/EmptyState";
import { StatusPill } from "@/features/coach/components/dashboard/StatusPill";
import { useCoachDashboard } from "@/features/shared/hooks/useCoachDashboard";
import { usePlanningMargin } from "@/features/shared/hooks/usePlanningMargin";
import { useRecentRecords } from "@/features/shared/hooks/useRecentRecords";
import { useUpcomingCompetitions } from "@/features/shared/hooks/useUpcomingCompetitions";
import { useRecentActivity } from "@/features/shared/hooks/useRecentActivity";
import { useAuth } from "@/hooks/useAuth";
import { C } from "@/lib/theme";
import { COMPETITION_META } from "@/types/planning";
import type { SessionStatus } from "@/features/shared/hooks/useCoachDashboard";

// ── Animation variants ─────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
};

// ── Visual mappings ────────────────────────────────────────────────────────────

const STATUS_EMOJI: Record<SessionStatus, string> = {
  planned:     "📋",
  in_progress: "⚡",
  completed:   "✅",
  missed:      "❌",
  skipped:     "⏩",
};

const WELL_EMOJI = (s: number) => s >= 70 ? "💚" : s >= 50 ? "🟡" : "🔴";

const ACTIVITY_EMOJI: Record<string, string> = {
  session:  "💪",
  wellness: "🧘",
  pr:       "🏆",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ emoji, children }: { emoji?: string; children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#7C7480] mb-3 flex items-center gap-1.5">
      {emoji && <span className="text-[12px]">{emoji}</span>}
      {children}
    </p>
  );
}

function Card({ children, className = "", onClick }: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={[
        "bg-[#252327] border border-[rgba(124,116,128,0.15)] rounded-2xl p-4",
        onClick ? "cursor-pointer transition-colors hover:border-[rgba(168,85,247,0.4)]" : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-xl bg-[#2A282C]" />
      ))}
    </div>
  );
}

function InitialAvatar({ name, color }: { name: string; color?: string }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
      style={{ background: (color ?? C.ac) + "25", color: color ?? C.ac }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CoachHomePage() {
  const navigate  = useNavigate();
  const { profile, athletes, user } = useAuth();
  const isCoachAthlete = profile?.role === "coach_athlete";

  const { todayAthletes, missedSessions, upcomingTests, isLoadingToday, isLoadingMissed, isLoadingTests } = useCoachDashboard();
  const { cycles: endingSoon, isLoading: loadMargin }   = usePlanningMargin(14);
  const { records, isLoading: loadRecords }             = useRecentRecords(8);
  const { competitions, isLoading: loadCompet }         = useUpcomingCompetitions(30);
  const { activities, isLoading: loadActivity }         = useRecentActivity(8);

  const firstName  = profile?.full_name?.split(" ")[0] ?? "Coach";
  const todayLabel = format(new Date(), "EEEE d MMMM", { locale: fr });

  const compA  = competitions.filter((c) => c.priority === "A" && c.daysUntil <= 14);
  const compBC = competitions.filter((c) => !(c.priority === "A" && c.daysUntil <= 14));

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 pb-20">

      {/* ── Header ── */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="mb-8">
        <motion.div variants={fadeUp}>
          <h1 className="text-xl font-extrabold tracking-tight" style={{ color: C.tx }}>
            Bonjour, {firstName} 👋
          </h1>
          <p className="text-[12px] mt-1 capitalize" style={{ color: C.tx3 }}>
            {todayLabel} · {athletes.length} athlète{athletes.length !== 1 ? "s" : ""}
            {isCoachAthlete ? " · ton programme inclus" : ""}
          </p>
        </motion.div>

        {/* Action counters */}
        <motion.div variants={fadeUp} className="mt-5 grid grid-cols-2 gap-3">
          <ActionCounter
            emoji="⚠️"
            icon={<Calendar size={14} />}
            label="Manquées hier"
            count={missedSessions.length}
            loading={isLoadingMissed}
            color={missedSessions.length > 0 ? C.o : C.tx3}
            onClick={() => navigate("/coach/athletes")}
          />
          <ActionCounter
            emoji="🧪"
            icon={<FlaskConical size={14} />}
            label="Tests à venir"
            count={upcomingTests.length}
            loading={isLoadingTests}
            color={upcomingTests.length > 0 ? C.b : C.tx3}
            onClick={() => navigate("/coach/athletes")}
          />
        </motion.div>
      </motion.div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column (2/3) ── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="lg:col-span-2 flex flex-col gap-6">

          {/* Aujourd'hui */}
          <motion.div variants={fadeUp}>
            <SectionTitle emoji="📅">Aujourd'hui</SectionTitle>
            <Card>
              {isLoadingToday ? (
                <SkeletonRows n={3} />
              ) : todayAthletes.length === 0 ? (
                <p className="text-[12px] text-center py-4" style={{ color: C.tx3 }}>
                  Aucune séance planifiée aujourd'hui
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {todayAthletes.map((a) => (
                    <div
                      key={a.athleteId}
                      onClick={() => navigate(`/coach/athletes/${a.athleteId}/planning`)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                      style={{
                        borderLeft: `3px solid ${a.wellnessScore != null ? a.wellnessColor : C.brdL}`,
                      }}
                    >
                      <InitialAvatar
                        name={a.athleteName}
                        color={a.wellnessScore != null ? a.wellnessColor : undefined}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: C.tx }}>
                          {a.athleteName}
                        </p>
                        {a.sessions.length > 0 ? (
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {a.sessions.map((s) => (
                              <span key={s.id} className="flex items-center gap-1">
                                <span className="text-[11px]">{STATUS_EMOJI[s.status]}</span>
                                <span className="text-[11px] truncate max-w-[110px]" style={{ color: C.tx2 }}>
                                  {s.sessionName ?? "Séance"}
                                </span>
                                <StatusPill status={s.status} />
                                {s.rpeScore != null && (
                                  <span className="text-[10px] font-bold px-1.5 py-px rounded bg-[rgba(59,141,240,0.12)] text-[#3B8DF0] border border-[rgba(59,141,240,0.25)]">
                                    RPE {s.rpeScore}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] mt-0.5" style={{ color: C.tx3 }}>Pas de séance planifiée</p>
                        )}
                      </div>

                      {a.wellnessScore != null && (
                        <div className="flex flex-col items-center shrink-0 gap-0.5">
                          <span className="text-[14px] leading-none">{WELL_EMOJI(a.wellnessScore)}</span>
                          <span
                            className="text-[11px] font-bold leading-none"
                            style={{ color: a.wellnessColor }}
                          >
                            {a.wellnessScore}
                          </span>
                        </div>
                      )}

                      <ChevronRight size={14} style={{ color: C.tx3 }} className="shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Alertes — séances manquées */}
          {missedSessions.length > 0 && (
            <motion.div variants={fadeUp}>
              <SectionTitle emoji="⚠️">À traiter</SectionTitle>
              <Card>
                <p className="text-[11px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: C.o }}>
                  <span>❌</span> Séances manquées hier
                </p>
                <div className="flex flex-col gap-1.5">
                  {missedSessions.map((m) => (
                    <div
                      key={`${m.athleteId}_${m.date}`}
                      onClick={() => navigate(`/coach/athletes/${m.athleteId}/planning`)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[rgba(251,146,60,0.06)] transition-colors"
                      style={{ borderLeft: `3px solid ${C.o}` }}
                    >
                      <InitialAvatar name={m.athleteName} color={C.o} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold" style={{ color: C.tx }}>{m.athleteName}</p>
                        <p className="text-[10px]" style={{ color: C.tx3 }}>{m.sessionName ?? "Séance"}</p>
                      </div>
                      <ChevronRight size={14} style={{ color: C.tx3 }} />
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Activité récente */}
          <motion.div variants={fadeUp}>
            <SectionTitle emoji="🕐">Activité récente</SectionTitle>
            <Card>
              {loadActivity ? (
                <SkeletonRows n={4} />
              ) : activities.length === 0 ? (
                <p className="text-[12px] text-center py-4" style={{ color: C.tx3 }}>
                  Aucune activité récente
                </p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      onClick={() => navigate(`/coach/athletes/${act.athleteId}/planning`)}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-xl cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[15px]"
                        style={{
                          background: act.type === "session" ? C.acS : act.type === "wellness" ? C.gS : C.yS,
                        }}
                      >
                        {ACTIVITY_EMOJI[act.type] ?? "📌"}
                      </div>
                      <p className="flex-1 text-[12px] truncate" style={{ color: C.tx2 }}>{act.label}</p>
                      <p className="text-[10px] shrink-0" style={{ color: C.tx3 }}>
                        {formatDistanceToNow(act.updatedAt, { locale: fr, addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Self as athlete shortcut */}
          {isCoachAthlete && user && (
            <motion.div variants={fadeUp}>
              <SectionTitle emoji="🏋️">Mon programme</SectionTitle>
              <button
                onClick={() => navigate(`/coach/athletes/${user.id}/planning`)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors hover:border-[rgba(168,85,247,0.5)]"
                style={{ background: C.acS, border: `1px solid ${C.ac}40`, fontFamily: "inherit" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                  style={{ background: C.ac + "25", color: C.ac }}
                >
                  {(profile?.full_name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: C.tx }}>{profile?.full_name}</p>
                  <p className="text-[10px]" style={{ color: C.ac }}>Mon programme personnel</p>
                </div>
                <ChevronRight size={14} style={{ color: C.ac }} className="ml-auto" />
              </button>
            </motion.div>
          )}

          {/* Empty state: no athletes */}
          {athletes.length === 0 && !isCoachAthlete && (
            <motion.div variants={fadeUp}>
              <EmptyState
                icon={Users}
                title="Aucun athlète pour l'instant"
                description={`Code coach : ${profile?.coach_code ?? "—"} — partage-le pour que tes athlètes te rejoignent.`}
                cta={{ label: "Gérer les athlètes", onClick: () => navigate("/coach/athletes") }}
              />
            </motion.div>
          )}
        </motion.div>

        {/* ── Right column (1/3) ── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-6">

          {/* À anticiper */}
          <motion.div variants={fadeUp}>
            <SectionTitle emoji="📆">À anticiper</SectionTitle>
            <Card>
              {loadMargin ? (
                <SkeletonRows n={3} />
              ) : endingSoon.length === 0 ? (
                <p className="text-[11px] text-center py-3" style={{ color: C.tx3 }}>
                  Aucun cycle se terminant bientôt
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {endingSoon.map((c) => {
                    const urgent = c.daysLeft <= 7;
                    const color  = urgent ? C.r : C.o;
                    return (
                      <div
                        key={c.cycleId}
                        onClick={() => navigate(`/coach/athletes/${c.athleteId}/planning`)}
                        className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-colors"
                        style={{
                          background:  color + "0D",
                          border:      `1px solid ${color}30`,
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = color + "1A")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = color + "0D")}
                      >
                        <span className="text-[16px] shrink-0">{urgent ? "🔴" : "🟠"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold truncate" style={{ color: C.tx }}>{c.athleteName}</p>
                          <p className="text-[10px] truncate" style={{ color: C.tx3 }}>{c.cycleName}</p>
                        </div>
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-lg shrink-0"
                          style={{ background: color + "25", color }}
                        >
                          J-{c.daysLeft}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Records & tests */}
          <motion.div variants={fadeUp}>
            <SectionTitle emoji="🏅">Records & tests</SectionTitle>
            <Card>
              {loadRecords ? (
                <SkeletonRows n={3} />
              ) : records.length === 0 ? (
                <p className="text-[11px] text-center py-3" style={{ color: C.tx3 }}>
                  Aucun résultat récent
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {records.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/coach/athletes/${r.athleteId}/tests`)}
                      className="flex items-center gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                    >
                      <span className="text-[16px] shrink-0">
                        {r.coachValidated === true ? "🏆" : r.coachValidated === null ? "🔵" : "📊"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold truncate" style={{ color: C.tx }}>
                          {r.metricName}
                        </p>
                        <p className="text-[10px]" style={{ color: C.tx3 }}>{r.athleteName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-extrabold" style={{ color: C.ac }}>
                          {r.value} <span className="text-[10px] font-normal" style={{ color: C.tx3 }}>{r.unit}</span>
                        </p>
                        <p className="text-[10px]" style={{ color: C.tx3 }}>
                          {format(parseISO(r.date), "dd/MM")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Compétitions */}
          <motion.div variants={fadeUp}>
            <SectionTitle emoji="🏆">Compétitions</SectionTitle>
            <Card>
              {loadCompet ? (
                <SkeletonRows n={3} />
              ) : competitions.length === 0 ? (
                <p className="text-[11px] text-center py-3" style={{ color: C.tx3 }}>
                  Aucune compétition dans les 30 jours
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {compA.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold flex items-center gap-1" style={{ color: C.r }}>
                        <span>🔴</span> Priorité A — imminentes
                      </p>
                      {compA.map((c) => {
                        const meta = COMPETITION_META[c.type];
                        return (
                          <div
                            key={c.id}
                            onClick={() => navigate(`/coach/athletes/${c.athlete_id}/planning`)}
                            className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-colors"
                            style={{ background: C.rS, border: `1px solid ${C.r}30` }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(239,75,75,0.14)")}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = C.rS)}
                          >
                            <span className="text-[16px] shrink-0">{meta.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold truncate" style={{ color: C.tx }}>{c.name}</p>
                              <p className="text-[10px]" style={{ color: C.tx3 }}>{c.athleteName}</p>
                            </div>
                            <span className="text-[12px] font-bold shrink-0" style={{ color: C.r }}>
                              J-{c.daysUntil}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {compA.length > 0 && compBC.length > 0 && (
                    <div className="border-t" style={{ borderColor: C.brd }} />
                  )}

                  {compBC.map((c) => {
                    const meta = COMPETITION_META[c.type];
                    return (
                      <div
                        key={c.id}
                        onClick={() => navigate(`/coach/athletes/${c.athlete_id}/planning`)}
                        className="flex items-center gap-2 p-2 rounded-xl cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                      >
                        <span className="text-[16px] shrink-0">{meta.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold truncate" style={{ color: C.tx }}>{c.name}</p>
                          <p className="text-[10px]" style={{ color: C.tx3 }}>
                            {c.athleteName} · {c.priority}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold shrink-0" style={{ color: C.tx3 }}>
                          J-{c.daysUntil}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}

// ── Action counter tile ────────────────────────────────────────────────────────

interface ActionCounterProps {
  emoji:    string;
  icon:     React.ReactNode;
  label:    string;
  count:    number;
  loading:  boolean;
  color:    string;
  onClick?: () => void;
}

function ActionCounter({ emoji, label, count, loading, color, onClick }: ActionCounterProps) {
  return (
    <div
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl border transition-all cursor-pointer"
      style={{
        background:  count > 0 ? color + "12" : "#252327",
        borderColor: count > 0 ? color + "45" : "rgba(124,116,128,0.15)",
      }}
    >
      <span className="text-[20px] leading-none">{emoji}</span>
      {loading ? (
        <Skeleton className="h-7 w-10 rounded bg-[#2A282C]" />
      ) : (
        <p
          className="text-[26px] font-extrabold leading-none"
          style={{ color: count > 0 ? color : "#7C7480" }}
        >
          {count}
        </p>
      )}
      <p className="text-[9px] font-bold uppercase tracking-wide text-center leading-tight" style={{ color: "#7C7480" }}>
        {label}
      </p>
    </div>
  );
}
