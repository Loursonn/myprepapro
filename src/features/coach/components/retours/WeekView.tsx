import { eachDayOfInterval, startOfWeek, endOfWeek, format } from "date-fns";
import { C } from "@/lib/theme";
import { DayColumn } from "./DayColumn";
import type { WeeklyRetourData, WellnessDay } from "@/features/shared/types/retours.types";

interface WeekViewProps {
  weekData:     WeeklyRetourData;
  prevWeekData?: WeeklyRetourData | null;
}

export function WeekView({ weekData, prevWeekData }: WeekViewProps) {
  const weekStart = startOfWeek(new Date(weekData.start_date + "T12:00:00"), { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days      = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Index by date
  const workoutsByDate: Record<string, typeof weekData.workouts> = {};
  for (const w of weekData.workouts) {
    if (!workoutsByDate[w.scheduled_date]) workoutsByDate[w.scheduled_date] = [];
    workoutsByDate[w.scheduled_date].push(w);
  }

  const energyByDate: Record<string, typeof weekData.energy_sessions> = {};
  for (const e of weekData.energy_sessions) {
    if (!energyByDate[e.date]) energyByDate[e.date] = [];
    energyByDate[e.date].push(e);
  }

  const freeByDate: Record<string, typeof weekData.free_activities> = {};
  for (const f of (weekData.free_activities ?? [])) {
    if (!freeByDate[f.date]) freeByDate[f.date] = [];
    freeByDate[f.date].push(f);
  }

  const prevWorkouts = prevWeekData?.workouts ?? [];

  return (
    /* Horizontal scroll container */
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(130px, 1fr))",
        gap: 6,
        minWidth: 910,
      }}>
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          return (
            <DayColumn
              key={dateStr}
              date={dateStr}
              workouts={workoutsByDate[dateStr] ?? []}
              energy={energyByDate[dateStr]     ?? []}
              wellness={(weekData.daily_wellness[dateStr] as WellnessDay | null) ?? null}
              previousWorkouts={prevWorkouts}
              freeActivities={freeByDate[dateStr] ?? []}
            />
          );
        })}
      </div>
    </div>
  );
}
