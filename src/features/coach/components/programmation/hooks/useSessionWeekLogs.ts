import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import type { AthleteModifications } from "@/features/shared/types/athlete"

export interface SessionWeekLog {
  id: string
  scheduledDate: string
  status: string
  rpeScore: number | null
  athleteModifications: AthleteModifications | null
  microcycleId: string | null
  weekNumber: number | null
  notes: string | null
}

export interface MicrocycleInfo {
  id: string
  week_number: number
  start_date: string
  end_date: string
  is_deload: boolean
}

export function useSessionWeekLogs(
  athleteId: string | undefined,
  sessionId: string,
  cycleId: string | undefined,
) {
  const { data: microcycles = [] } = useQuery<MicrocycleInfo[]>({
    queryKey: ["microcycles-weeks", cycleId],
    enabled: !!cycleId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("microcycles")
        .select("id, week_number, start_date, end_date, is_deload")
        .eq("cycle_id", cycleId!)
        .order("week_number")
      return (data ?? []) as MicrocycleInfo[]
    },
  })

  const { data: rawLogs = [], isLoading } = useQuery({
    queryKey: ["session-week-logs", athleteId, sessionId],
    enabled: !!athleteId && !!sessionId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("workout_logs")
        .select("id, scheduled_date, status, rpe_score, athlete_modifications, microcycle_id, notes")
        .eq("athlete_id", athleteId!)
        .eq("session_id", sessionId)
        .neq("status", "skipped")
        .order("scheduled_date", { ascending: false })
      return data ?? []
    },
  })

  const microMap = new Map<string, number>(
    microcycles.map(m => [m.id, m.week_number])
  )

  const logs: SessionWeekLog[] = rawLogs.map(log => ({
    id:                   log.id,
    scheduledDate:        log.scheduled_date,
    status:               log.status,
    rpeScore:             log.rpe_score,
    athleteModifications: log.athlete_modifications as AthleteModifications | null,
    microcycleId:         log.microcycle_id,
    weekNumber:           log.microcycle_id ? (microMap.get(log.microcycle_id) ?? null) : null,
    notes:                log.notes,
  }))

  function getLogForWeek(weekNumber: number): SessionWeekLog | null {
    return logs.find(l => l.weekNumber === weekNumber) ?? null
  }

  function getStatusForWeek(weekNumber: number): "completed" | "missed" | "planned" | null {
    const log = getLogForWeek(weekNumber)
    if (!log) return null
    if (log.status === "completed") return "completed"
    if (log.status === "missed")    return "missed"
    return "planned"
  }

  return { logs, getLogForWeek, getStatusForWeek, microcycles, isLoading }
}
