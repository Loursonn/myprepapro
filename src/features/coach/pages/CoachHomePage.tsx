import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Users, AlertTriangle, Trophy, Activity,
  TrendingUp, Calendar, CheckCheck, ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/features/shared/components/EmptyState";
import { StatusPill } from "@/features/coach/components/dashboard/StatusPill";
import { useCoachDashboard } from "@/features/shared/hooks/useCoachDashboard";
import { usePlanningMargin } from "@/features/shared/hooks/usePlanningMargin";
import { useRecentRecords } from "@/features/shared/hooks/useRecentRecords";
import { useOverloadedAthletes } from "@/features/shared/hooks/useOverloadedAthletes";
import { useUpcomingCompetitions } from "@/features/shared/hooks/useUpcomingCompetitions";
import { useRecentActivity } from "@/features/shared/hooks/useRecentActivity";
import { useAuth } from "@/hooks/useAuth";
import { C } from "@/lib/theme";

// ── Animation variants ─────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#7C7480] mb-3">
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

  const { todayAthletes, missedSessions, isLoadingToday, isLoadingMissed } = useCoachDashboard();
  const { cycles: endingSoon, isLoading: loadMargin }   = usePlanningMargin(14);
  const { records, isLoading: loadRecords }             = useRecentRecords(8);
  const { overloaded, isLoading: loadOverloaded }       = useOverloadedAthletes();
  const { competitions, isLoading: loadCompet }         = useUpcomingCompetitions(30);
  const { activities, isLoading: loadActivity }         = useRecentActivity(8);

  const pendingRecords = records.filter((r) => r.coachValidated === null);

  // ── Greeting ─────────────────────────────────────────────────────────────────
  const firstName = profile?.full_name?.split(" ")[0] ?? "Coach";
  const todayLabel = format(new Date(), "EEEE d MMMM", { locale: fr });

  // ── Competitions split ────────────────────────────────────────────────────────
  const compA  = competitions.filter((c) => c.priority === "A" && c.daysUntil <= 14);
  const compBC = competitions.filter((c) => !(c.priority === "A" && c.daysUntil <= 14));

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 pb-20">

      {/* ── Header ── */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mb-8"
      >
        <motion.div variants={fadeUp}>
          <h1 className="text-xl font-extrabold tracking-tight" style={{ color: C.tx }}>
            Bonjour, {firstName} 👋
          </h1>
          <p className="text-[12px] mt-1 capitalize" style={{ color: C.tx3 }}>
            {todayLabel}
            {" · "}
            {athletes.length} athlète{athletes.length !== 1 ? "s" : ""}
            {isCoachAthlete ? " · ton programme inclus" : ""}
          </p>
        </motion.div>

        {/* Action counters */}
        <motion.div variants={fadeUp} className="mt-5 grid grid-cols-3 gap-3">
          <ActionCounter
            icon={<AlertTriangle size={14} />}
            label="Surcharges"
            count={overloaded.length}
            loading={loadOverloaded}
            color={overloaded.length > 0 ? C.r : C.tx3}
            onClick={() => navigate("/coach/athletes")}
          />
          <ActionCounter
            icon={<Calendar size={14} />}
            label="Manquées hier"
            count={missedSessions.length}
            loading={isLoadingMissed}
            color={missedSessions.length > 0 ? C.o : C.tx3}
            onClick={() => navigate("/coach/athletes")}
          />
          <ActionCounter
            icon={<CheckCheck size={14} />}
            label="Perfs à valider"
            count={pendingRecords.length}
            loading={loadRecords}
            color={pendingRecords.length > 0 ? C.b : C.tx3}
            onClick={() => navigate("/coach/athletes")}
          />
        </motion.div>
      </motion.div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column (2/3) ── */}
        <motion.div
          variants={stagger} initial="hidden" animate="show"
          className="lg:col-span-2 flex flex-col gap-6"
        >

          {/* Aujourd'hui */}
          <motion.div variants={fadeUp}>
            <SectionTitle>Aujourd'hui</SectionTitle>
            <Card>
              {isLoadingToday ? (
                <SkeletonRows n={3} />
              ) : todayAthletes.length === 0 ? (
                <p className="text-[12px] text-center py-4" style={{ color: C.tx3 }}>
                  Aucune séance planifiée aujourd'hui
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {todayAthletes.map((a) => (
                    <div
                      key={a.athleteId}
                      onClick={() => navigate(`/coach/athletes/${a.athleteId}/planning`)}
                      className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      <InitialAvatar name={a.athleteName} color={a.wellnessScore != null ? a.wellnessColor : undefined} />

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: C.tx }}>
                          {a.athleteName}
                        </p>
                        {a.sessions.length > 0 ? (
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {a.sessions.map((s) => (
                              <span key={s.id} className="flex items-center gap-1.5">
                                <span className="text-[11px] truncate max-w-[120px]" style={{ color: C.tx2 }}>
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
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                          style={{ background: a.wellnessColor + "25", color: a.wellnessColor }}
                          title={`Wellness: ${a.wellnessScore}/100`}
                        >
                          {a.wellnessScore}
                        </div>
                      )}

                      <ChevronRight size={14} style={{ color: C.tx3 }} className="shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Alertes — surcharges + séances manquées */}
          {(overloaded.length > 0 || missedSessions.length > 0) && (
            <motion.div variants={fadeUp}>
              <SectionTitle>À traiter</SectionTitle>
              <div className="flex flex-col gap-3">

                {overloaded.length > 0 && (
                  <Card>
                    <p className="text-[11px] font-semibold mb-2" style={{ color: C.r }}>
                      Athlètes en surcharge
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {overloaded.map((a) => (
                        <div
                          key={a.id}
                          onClick={() => navigate(`/coach/athletes/${a.id}/donnees`)}
                          className="flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-[rgba(239,75,75,0.06)] transition-colors"
                        >
                          <InitialAvatar name={a.full_name} color={C.r} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold" style={{ color: C.tx }}>{a.full_name}</p>
                            <p className="text-[10px]" style={{ color: C.tx3 }}>
                              {[
                                a.fatigue > 7 ? `Fatigue ${a.fatigue}/10` : null,
                                a.sleep < 5   ? `Sommeil ${a.sleep}/10`   : null,
                                `${a.streak}j consécutifs`,
                              ].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <ChevronRight size={14} style={{ color: C.tx3 }} />
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {missedSessions.length > 0 && (
                  <Card>
                    <p className="text-[11px] font-semibold mb-2" style={{ color: C.o }}>
                      Séances manquées hier
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {missedSessions.map((m) => (
                        <div
                          key={`${m.athleteId}_${m.date}`}
                          onClick={() => navigate(`/coach/athletes/${m.athleteId}/planning`)}
                          className="flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-[rgba(251,146,60,0.06)] transition-colors"
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
                )}
              </div>
            </motion.div>
          )}

          {/* Activité récente */}
          <motion.div variants={fadeUp}>
            <SectionTitle>Activité récente</SectionTitle>
            <Card>
              {loadActivity ? (
                <SkeletonRows n={4} />
              ) : activities.length === 0 ? (
                <p className="text-[12px] text-center py-4" style={{ color: C.tx3 }}>
                  Aucune activité récente
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      onClick={() => navigate(`/coach/athletes/${act.athleteId}/planning`)}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-xl cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: act.type === "session" ? C.acS : act.type === "wellness" ? C.gS : C.yS,
                          color:      act.type === "session" ? C.ac  : act.type === "wellness" ? C.g  : C.y,
                        }}
                      >
                        {act.type === "session"  ? <Activity size={12} /> :
                         act.type === "wellness" ? <TrendingUp size={12} /> :
                                                   <Trophy size={12} />}
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
              <SectionTitle>Mon programme</SectionTitle>
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
        <motion.div
          variants={stagger} initial="hidden" animate="show"
          className="flex flex-col gap-6"
        >

          {/* À anticiper */}
          <motion.div variants={fadeUp}>
            <SectionTitle>À anticiper</SectionTitle>
            <Card>
              {loadMargin ? (
                <SkeletonRows n={3} />
              ) : endingSoon.length === 0 ? (
                <p className="text-[11px] text-center py-3" style={{ color: C.tx3 }}>
                  Aucun cycle se terminant bientôt
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {endingSoon.map((c) => (
                    <div
                      key={c.cycleId}
                      onClick={() => navigate(`/coach/athletes/${c.athleteId}/planning`)}
                      className="flex items-center gap-2 p-2 rounded-xl cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold truncate" style={{ color: C.tx }}>{c.athleteName}</p>
                        <p className="text-[10px] truncate" style={{ color: C.tx3 }}>{c.cycleName}</p>
                      </div>
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded shrink-0"
                        style={{
                          background: c.daysLeft <= 7 ? C.rS : C.oS,
                          color:      c.daysLeft <= 7 ? C.r  : C.o,
                        }}
                      >
                        J-{c.daysLeft}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Records & tests */}
          <motion.div variants={fadeUp}>
            <SectionTitle>Records & tests</SectionTitle>
            <Card>
              {loadRecords ? (
                <SkeletonRows n={3} />
              ) : records.length === 0 ? (
                <p className="text-[11px] text-center py-3" style={{ color: C.tx3 }}>
                  Aucun résultat récent
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {records.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/coach/athletes/${r.athleteId}/tests`)}
                      className="flex items-center gap-2 p-2 rounded-xl cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold truncate" style={{ color: C.tx }}>
                          {r.metricName}
                        </p>
                        <p className="text-[10px]" style={{ color: C.tx3 }}>{r.athleteName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-bold" style={{ color: C.ac }}>
                          {r.value} {r.unit}
                        </p>
                        <p className="text-[10px]" style={{ color: C.tx3 }}>
                          {format(parseISO(r.date), "dd/MM")}
                        </p>
                      </div>
                      {r.coachValidated === null && (
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: C.b }}
                          title="En attente de validation"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Compétitions */}
          <motion.div variants={fadeUp}>
            <SectionTitle>Compétitions</SectionTitle>
            <Card>
              {loadCompet ? (
                <SkeletonRows n={3} />
              ) : competitions.length === 0 ? (
                <p className="text-[11px] text-center py-3" style={{ color: C.tx3 }}>
                  Aucune compétition dans les 30 jours
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {compA.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold mb-1.5" style={{ color: C.r }}>
                        Priorité A — imminentes
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {compA.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => navigate(`/coach/athletes/${c.athlete_id}/planning`)}
                            className="flex items-center gap-2 p-2 rounded-xl cursor-pointer hover:bg-[rgba(239,75,75,0.06)] transition-colors"
                          >
                            <Trophy size={12} style={{ color: C.r, flexShrink: 0 }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold truncate" style={{ color: C.tx }}>{c.name}</p>
                              <p className="text-[10px]" style={{ color: C.tx3 }}>{c.athleteName}</p>
                            </div>
                            <span className="text-[11px] font-bold shrink-0" style={{ color: C.r }}>
                              J-{c.daysUntil}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {compBC.length > 0 && (
                    <div>
                      {compA.length > 0 && (
                        <div className="border-t my-1" style={{ borderColor: C.brd }} />
                      )}
                      <div className="flex flex-col gap-1.5">
                        {compBC.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => navigate(`/coach/athletes/${c.athlete_id}/planning`)}
                            className="flex items-center gap-2 p-2 rounded-xl cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                          >
                            <Calendar size={12} style={{ color: C.tx3, flexShrink: 0 }} />
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
                        ))}
                      </div>
                    </div>
                  )}
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
  icon:     React.ReactNode;
  label:    string;
  count:    number;
  loading:  boolean;
  color:    string;
  onClick?: () => void;
}

function ActionCounter({ icon, label, count, loading, color, onClick }: ActionCounterProps) {
  return (
    <div
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border transition-colors cursor-pointer"
      style={{
        background:   count > 0 ? color + "10" : "#252327",
        borderColor:  count > 0 ? color + "40" : "rgba(124,116,128,0.15)",
      }}
    >
      <div style={{ color }}>{icon}</div>
      {loading ? (
        <Skeleton className="h-6 w-8 rounded bg-[#2A282C]" />
      ) : (
        <p className="text-[22px] font-extrabold leading-none" style={{ color: count > 0 ? color : "#7C7480" }}>
          {count}
        </p>
      )}
      <p className="text-[9px] font-bold uppercase tracking-wide text-center leading-tight" style={{ color: "#7C7480" }}>
        {label}
      </p>
    </div>
  );
}
