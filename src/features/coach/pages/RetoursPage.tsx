import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAthleteContext } from "@/features/shared/context/AthleteContext";
import {
  format, addMonths, subMonths, startOfMonth,
  addWeeks, subWeeks, startOfWeek,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { C } from "@/lib/theme";
import { PageSkeleton } from "@/features/shared/components/skeletons";
import { KPICard } from "@/features/coach/components/KPICard";
import { useMonthlyRetours } from "@/features/shared/hooks/useMonthlyRetours";
import { useWeeklyRetours } from "@/features/shared/hooks/useWeeklyRetours";
import { MonthCalendarView } from "../components/retours/MonthCalendarView";
import { WeekView } from "../components/retours/WeekView";
import { WellnessDetailView } from "../components/retours/WellnessDetailView";
import { WorkoutsDetailView } from "../components/retours/WorkoutsDetailView";
import { TestsDetailView } from "../components/retours/TestsDetailView";
import { CompetitionsDetailView } from "../components/retours/CompetitionsDetailView";

type ViewMode = "month" | "week";
type DetailView = "wellness" | "workouts" | "tests" | "competitions" | null;

export default function RetoursPage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const { goals } = useAthleteContext();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [selectedWeek, setSelectedWeek]   = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [detailView, setDetailView]       = useState<DetailView>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: monthData, isLoading: monthLoading } = useMonthlyRetours(athleteId!, selectedMonth);
  const { data: weekData,  isLoading: weekLoading  } = useWeeklyRetours(athleteId!, selectedWeek);

  const isLoading = viewMode === "month" ? monthLoading : weekLoading;
  if (isLoading) return <PageSkeleton />;

  // ── Labels ────────────────────────────────────────────────────────────────
  const monthLabel = format(selectedMonth, "MMMM yyyy", { locale: fr });
  const monthTitle = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const weekLabel = `${format(selectedWeek, "d MMM", { locale: fr })} → ${format(addWeeks(selectedWeek, 1), "d MMM yyyy", { locale: fr })}`;

  const periodLabel = viewMode === "month" ? monthTitle : weekLabel;

  // ── KPI source ────────────────────────────────────────────────────────────
  const kpiData = viewMode === "month" ? monthData : null;
  const weekCurrent = weekData?.current_week;

  const weekDone  = weekCurrent ? weekCurrent.workouts.filter(w => w.status === "completed").length + weekCurrent.energy_sessions.filter(e => e.completed || e.partial).length : 0;
  const weekTotal = weekCurrent ? weekCurrent.workouts.length + weekCurrent.energy_sessions.length : 0;

  const completionRate = kpiData && kpiData.workouts_total > 0
    ? Math.round((kpiData.workouts_completed / kpiData.workouts_total) * 100)
    : weekCurrent
      ? weekTotal > 0
        ? Math.round(weekDone / weekTotal * 100)
        : null
      : null;

  const avgWellness = kpiData?.avg_wellness ?? weekCurrent?.avg_wellness ?? null;

  function calcAvgRpe(workouts: { rpe_score: number | null }[], energySessions: { completed: boolean; rpe_score: number | null }[]): string | undefined {
    const vals = [
      ...workouts.filter(w => (w as { status?: string }).status === "completed").map(w => w.rpe_score),
      ...energySessions.filter(e => e.completed).map(e => e.rpe_score),
    ].filter((v): v is number => v != null);
    if (!vals.length) return undefined;
    return `RPE ${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)}/10`;
  }

  const avgRpeSubtitle = kpiData
    ? calcAvgRpe(kpiData.workouts, kpiData.energy_sessions)
    : weekCurrent
      ? calcAvgRpe(weekCurrent.workouts, weekCurrent.energy_sessions)
      : undefined;

  const workoutsVal = kpiData
    ? `${kpiData.workouts_completed}/${kpiData.workouts_total}`
    : weekCurrent
      ? `${weekDone}/${weekTotal}`
      : null;

  const testsVal = kpiData?.tests_completed
    ?? (weekCurrent ? weekCurrent.test_sessions.filter(t => t.completed).length : null);

  const compsVal = kpiData?.competitions.length
    ?? (weekCurrent ? weekCurrent.competitions.length : null);

  return (
    <div style={{ padding: "16px 20px 80px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.tx, letterSpacing: "-0.3px" }}>Retours</div>
          <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>{periodLabel}</div>
        </div>

        {/* View toggle + nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Month/Week toggle */}
          <div style={{ display: "flex", background: C.s2, borderRadius: 8, padding: 2 }}>
            {(["week", "month"] as ViewMode[]).map((m) => (
              <button key={m} onClick={() => setViewMode(m)} style={{
                padding: "4px 10px", borderRadius: 6, border: "none",
                background: viewMode === m ? C.s1 : "transparent",
                color: viewMode === m ? C.tx : C.tx3,
                fontSize: 11, fontWeight: viewMode === m ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit", transition: "all 120ms",
              }}>
                {m === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <button
            onClick={() => viewMode === "month"
              ? setSelectedMonth(m => subMonths(m, 1))
              : setSelectedWeek(w => subWeeks(w, 1))}
            style={navBtn}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => viewMode === "month"
              ? setSelectedMonth(startOfMonth(new Date()))
              : setSelectedWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            style={{ ...navBtn, padding: "5px 10px", fontSize: 11, fontWeight: 600 }}
          >
            Auj.
          </button>
          <button
            onClick={() => viewMode === "month"
              ? setSelectedMonth(m => addMonths(m, 1))
              : setSelectedWeek(w => addWeeks(w, 1))}
            style={navBtn}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 160px)", justifyContent: "center", gap: 10, marginBottom: 16 }}>
        {[
          { icon: "❤️",  title: "Wellness moyen", value: avgWellness, subtitle: "/100",                                                    onClick: () => setDetailView("wellness")     },
          { icon: "🏋️", title: "Séances",         value: workoutsVal, subtitle: completionRate != null ? `${completionRate}%` : undefined, subtitle2: avgRpeSubtitle, onClick: () => setDetailView("workouts") },
          { icon: "🧪",  title: "Tests",           value: testsVal,    subtitle: undefined,                                                onClick: () => setDetailView("tests")        },
          { icon: "🏆",  title: "Compétitions",    value: compsVal,    subtitle: undefined,                                                onClick: () => setDetailView("competitions") },
        ].map((kpi) => (
          <KPICard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Main content */}
      {viewMode === "week" && weekCurrent && (
        <WeekView
          weekData={weekCurrent}
          prevWeekData={weekData?.previous_week}
        />
      )}

      {viewMode === "month" && monthData && (
        <MonthCalendarView
          month={selectedMonth}
          dailyData={monthData.daily_data}
          workouts={monthData.workouts}
          energySessions={monthData.energy_sessions}
          energyByDate={Object.fromEntries(
            monthData.energy_sessions.reduce((acc, e) => {
              acc.set(e.date, (acc.get(e.date) ?? 0) + 1);
              return acc;
            }, new Map<string, number>())
          )}
        />
      )}

      {/* Detail overlays */}
      {detailView === "wellness" && (
        <WellnessDetailView
          dailyData={
            viewMode === "month" && monthData
              ? monthData.daily_data
              : weekCurrent
                ? Object.fromEntries(
                    Object.entries(weekCurrent.daily_wellness).map(([d, w]) => [d, {
                      date: d,
                      wellness: w,
                      workouts_completed: weekCurrent.workouts.filter(wk => wk.scheduled_date === d && wk.status === "completed").length,
                      has_competition: false,
                      has_test: false,
                    }])
                  )
                : {}
          }
          avgWellness={avgWellness}
          sleepGoals={{
            bedtime:        goals.sleepBedtime,
            wakeup:         goals.sleepWakeup,
            durationTarget: goals.sleepTarget,
          }}
          onClose={() => setDetailView(null)}
        />
      )}
      {detailView === "workouts" && (
        <WorkoutsDetailView
          workouts={
            viewMode === "month"
              ? (monthData?.workouts ?? [])
              : (weekCurrent?.workouts.map(w => ({
                  ...w,
                  session_type: "muscu" as const,
                })) ?? [])
          }
          energySessions={
            viewMode === "month"
              ? (monthData?.energy_sessions ?? [])
              : (weekCurrent?.energy_sessions ?? [])
          }
          onClose={() => setDetailView(null)}
        />
      )}
      {detailView === "tests" && (
        <TestsDetailView
          tests={
            viewMode === "month"
              ? (monthData?.test_sessions ?? [])
              : (weekCurrent?.test_sessions ?? [])
          }
          onClose={() => setDetailView(null)}
        />
      )}
      {detailView === "competitions" && (
        <CompetitionsDetailView
          competitions={
            viewMode === "month"
              ? (monthData?.competitions ?? [])
              : (weekCurrent?.competitions ?? [])
          }
          onClose={() => setDetailView(null)}
        />
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 28, height: 28, borderRadius: 8,
  border: "1px solid " + C.brd, background: C.s1,
  color: C.tx2, cursor: "pointer", fontFamily: "inherit",
};
