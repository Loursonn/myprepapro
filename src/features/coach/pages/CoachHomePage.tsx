import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { C } from "@/lib/theme";
import { EmptyState } from "@/features/shared/components/EmptyState";
import { Users } from "lucide-react";
import { useCoachOverview } from "@/features/shared/hooks/useCoachOverview";
import { useOverloadedAthletes } from "@/features/shared/hooks/useOverloadedAthletes";
import { useMissedWorkouts } from "@/features/shared/hooks/useMissedWorkouts";
import { useUpcomingCompetitions } from "@/features/shared/hooks/useUpcomingCompetitions";
import { useRecentActivity } from "@/features/shared/hooks/useRecentActivity";
import { KPICard } from "@/features/coach/components/KPICard";
import { AlertCard } from "@/features/coach/components/AlertCard";
import { ActivityTimeline } from "@/features/coach/components/ActivityTimeline";

// ── Inline styles for responsive grid ────────────────────────────────────────

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: C.tx3,
  textTransform: "uppercase", letterSpacing: "0.6px",
  marginBottom: 12,
};

const GRID_4: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 12,
};

const GRID_2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  gap: 16,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoachHomePage() {
  const navigate = useNavigate();
  const { profile, athletes, user } = useAuth();
  const isCoachAthlete = profile?.role === "coach_athlete";

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const overview = useCoachOverview();
  const { overloaded, isLoading: loadOverloaded } = useOverloadedAthletes();
  const { missed,    isLoading: loadMissed }      = useMissedWorkouts();
  const { competitions, isLoading: loadCompet }   = useUpcomingCompetitions(30);
  const { activities, isLoading: loadActivity }   = useRecentActivity(10);

  // Shortcut: athletes with no planned session for next week
  // (placeholder — requires complex query; shown as empty state for now)
  const noNextWeekAthletes: { id: string; full_name: string }[] = [];

  // ── Session ratio label ─────────────────────────────────────────────────────
  const sessionLabel = overview.sessionRatio
    ? `${overview.sessionRatio.completed} / ${overview.sessionRatio.planned}`
    : null;
  const sessionSub = overview.sessionRatio
    ? (() => {
        const pct = overview.sessionRatio.planned
          ? Math.round((overview.sessionRatio.completed / overview.sessionRatio.planned) * 100)
          : 0;
        return `${pct}% complétées`;
      })()
    : undefined;

  // ── Upcoming competitions split by priority ─────────────────────────────────
  const priorityA = competitions.filter((c) => c.priority === "A" && c.daysUntil <= 14);
  const priorityBC = competitions.filter((c) => c.priority !== "A" || c.daysUntil > 14);

  return (
    <div style={{ padding: "24px 24px 48px", maxWidth: 1100, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.tx, letterSpacing: "-0.4px" }}>
          Bonjour, {profile?.full_name?.split(" ")[0] ?? "Coach"} 👋
        </div>
        <div style={{ fontSize: 12, color: C.tx3, marginTop: 4 }}>
          {athletes.length} athlète{athletes.length !== 1 ? "s" : ""}
          {isCoachAthlete ? " · ton programme personnel inclus" : ""}
        </div>
      </div>

      {/* ── Row 1 — KPIs ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={SECTION_TITLE}>Vue d'ensemble</div>
        <div style={GRID_4}>
          <KPICard
            icon="👥"
            title="Athlètes actifs"
            value={overview.athleteCount || null}
            subtitle={overview.athleteCount === 0 ? "Aucun athlète lié" : undefined}
            loading={overview.isLoading}
            onClick={() => navigate("/coach/athletes")}
          />
          <KPICard
            icon="✅"
            title="Séances cette semaine"
            value={sessionLabel}
            subtitle={sessionSub}
            loading={overview.isLoading}
          />
          <KPICard
            icon="❤️"
            title="Wellness équipe"
            value={overview.wellnessMean !== null ? `${overview.wellnessMean}` : null}
            subtitle={overview.wellnessMean !== null ? "Moyenne du jour /100" : "Aucune donnée"}
            valueColor={overview.wellnessColor}
            loading={overview.isLoading}
          />
          <KPICard
            icon="🏆"
            title="Compétitions <30j"
            value={overview.competitionsCount || null}
            subtitle={overview.competitionsCount === 0 ? "Aucune à venir" : "à venir"}
            valueColor={overview.competitionsCount > 0 ? "#D4538E" : undefined}
            loading={overview.isLoading}
            onClick={() => navigate("/coach/athletes")}
          />
        </div>
      </div>

      {/* ── Row 2 — Alertes ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={SECTION_TITLE}>Alertes</div>
        <div style={GRID_2}>
          {/* Left — À traiter */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx2 }}>À traiter</div>

            <AlertCard
              icon="🔴"
              title="Athlètes en surcharge"
              variant="danger"
              loading={loadOverloaded}
              emptyMessage="Aucun athlète en surcharge 👌"
              rows={overloaded.map((a) => ({
                id: a.id,
                label: a.full_name,
                sublabel: [
                  a.fatigue > 7 ? `Fatigue ${a.fatigue}/10` : null,
                  a.sleep < 5   ? `Sommeil ${a.sleep}/10`   : null,
                  `${a.streak}j consécutifs`,
                ].filter(Boolean).join(" · "),
                onClick: () => navigate(`/coach/athletes/${a.id}/donnees`),
              }))}
            />

            <AlertCard
              icon="⚠️"
              title="Séances manquées hier"
              variant="warning"
              loading={loadMissed}
              emptyMessage="Aucune séance manquée hier 👌"
              rows={missed.map((m) => ({
                id: `${m.athleteId}_${m.sessionId}`,
                label: m.athleteName,
                sublabel: m.sessionName,
                onClick: () => navigate(`/coach/athletes/${m.athleteId}/planning`),
              }))}
            />
          </div>

          {/* Right — À venir */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.tx2 }}>À venir</div>

            <AlertCard
              icon="🏆"
              title="Compétitions priorité A (<14j)"
              variant="coach"
              loading={loadCompet}
              emptyMessage="Aucune compétition imminente"
              rows={priorityA.map((c) => ({
                id: c.id,
                label: c.name,
                sublabel: `${c.athleteName} · J-${c.daysUntil}`,
                onClick: () => navigate(`/coach/athletes/${c.athlete_id}/planning`),
              }))}
            />

            <AlertCard
              icon="📅"
              title="Compétitions à venir (<30j)"
              variant="warning"
              loading={loadCompet}
              emptyMessage="Aucune compétition dans les 30 prochains jours"
              rows={priorityBC.map((c) => ({
                id: c.id,
                label: c.name,
                sublabel: `${c.athleteName} · ${c.priority} · J-${c.daysUntil}`,
                onClick: () => navigate(`/coach/athletes/${c.athlete_id}/planning`),
              }))}
            />

            <AlertCard
              icon="📋"
              title="Sans séance planifiée (semaine prochaine)"
              variant="success"
              loading={false}
              emptyMessage="Tous les athlètes ont une séance planifiée 🎯"
              rows={noNextWeekAthletes.map((a) => ({
                id: a.id,
                label: a.full_name,
                onClick: () => navigate(`/coach/athletes/${a.id}/planning`),
              }))}
            />
          </div>
        </div>
      </div>

      {/* ── Row 3 — Timeline ── */}
      <div>
        <div style={SECTION_TITLE}>Activité récente</div>
        <ActivityTimeline
          activities={activities}
          loading={loadActivity}
          onAthleteClick={(id) => navigate(`/coach/athletes/${id}/planning`)}
        />
      </div>

      {/* ── Quick access (athletes without planned view) ── */}
      {athletes.length === 0 && !isCoachAthlete && (
        <div style={{ marginTop: 32 }}>
          <EmptyState
            icon={Users}
            title="Aucun athlète pour l'instant"
            description={`Code coach : ${profile?.coach_code ?? "—"} — partage-le pour que tes athlètes te rejoignent.`}
            cta={{ label: "Gérer les athlètes", onClick: () => navigate("/coach/athletes") }}
          />
        </div>
      )}

      {/* ── Self as athlete shortcut (coach_athlete) ── */}
      {isCoachAthlete && user && (
        <div style={{ marginTop: 24 }}>
          <div style={SECTION_TITLE}>Mon programme</div>
          <button
            onClick={() => navigate(`/coach/athletes/${user.id}/planning`)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderRadius: 12,
              border: "1px solid " + C.ac + "40", background: C.acS,
              cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              transition: "border-color 150ms",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = C.ac + "80")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = C.ac + "40")}
          >
            <div
              style={{
                width: 34, height: 34, borderRadius: "50%",
                background: C.ac + "25",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: C.ac, flexShrink: 0,
              }}
            >
              {(profile?.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.tx }}>
                {profile?.full_name}
              </div>
              <div style={{ fontSize: 10, color: C.ac }}>Mon programme personnel</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
