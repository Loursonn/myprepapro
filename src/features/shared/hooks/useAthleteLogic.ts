import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { todayKey } from "@/lib/date";
import { checkMilestone } from "@/lib/date";
import { SKEYS } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import type {
  ExosMap, SetsMap, Session, BlockConfig, Goals, WellnessData,
  Injury, ArchivedBlock, NewBlockOpts, BodyWeight, VisibilitySettings,
} from "../types/athlete";

interface LogicDeps {
  athleteId: string;
  exos: ExosMap;
  sets: SetsMap;
  sessions: Session[];
  blockConfig: BlockConfig;
  goals: Goals;
  completedSessions: Record<number, string[]>;
  wellnessHistory: Record<string, WellnessData>;
  bodyWeight: BodyWeight;
  weightLog: Record<string, number>;
  weightMilestones: Array<{ date: string; kg: number }>;
  injuries: Injury[];
  blockHistory: ArchivedBlock[];
  tw: number;
  dw: number;
  weeksArr: number[];
  weeklyTarget: Record<number, number>;
  loaded: boolean;
  // setters
  setExos: (v: ExosMap | ((p: ExosMap) => ExosMap)) => void;
  setSets: (v: SetsMap) => void;
  setSessions: (v: Session[] | ((p: Session[]) => Session[])) => void;
  setBlockConfig: (v: BlockConfig | ((p: BlockConfig) => BlockConfig)) => void;
  setGoals: (v: Goals | ((p: Goals) => Goals)) => void;
  setCompletedSessions: (v: Record<number, string[]>) => void;
  setAthleteNotes: (v: Record<string, string>) => void;
  setBlockHistory: (v: ArchivedBlock[]) => void;
  setWellness: (v: WellnessData | null) => void;
  setWellnessHistory: (v: Record<string, WellnessData>) => void;
  setWeightLog: (v: Record<string, number>) => void;
  setWeightMilestones: (v: Array<{ date: string; kg: number }>) => void;
  setBodyWeight: (v: BodyWeight) => void;
  setInjuries: (v: Injury[]) => void;
  setVisibilitySettings: (v: VisibilitySettings) => Promise<void>;
  setMilestoneNotif: (v: number | null) => void;
  setWeekJustCompleted: (v: number | null) => void;
  setShowBilan: (v: boolean) => void;
  setAW: (v: number) => void;
  save: (k: string, v: unknown) => Promise<void>;
}

export function useAthleteLogic(d: LogicDeps) {
  const qc = useQueryClient();
  const {
    athleteId, exos, sets, sessions, blockConfig, goals, completedSessions,
    wellnessHistory, bodyWeight, weightLog, weightMilestones, injuries, blockHistory,
    tw, dw, weeksArr, weeklyTarget, loaded,
    setExos, setSets, setSessions, setBlockConfig, setGoals, setCompletedSessions,
    setAthleteNotes, setBlockHistory, setWellness, setWellnessHistory,
    setWeightLog, setWeightMilestones, setBodyWeight, setInjuries,
    setMilestoneNotif, setWeekJustCompleted, setShowBilan, setAW, save,
  } = d;

  // Calcule la date exacte planifiée pour une séance dans une semaine donnée
  const sessionScheduledDate = useCallback((sessId: string, week: number): string | null => {
    if (!blockConfig?.startDate) return null;
    const sess = sessions.find(s => s.id === sessId);
    const dow = (sess?.weekDays?.[String(week)] ?? sess?.day_of_week) as number | undefined;
    if (dow == null) return null;
    const d0 = new Date(blockConfig.startDate + "T12:00:00");
    const weekDow = d0.getDay();
    // Snap to Monday of block start week, then add (week-1)*7 + dow
    d0.setDate(d0.getDate() + (weekDow === 0 ? -6 : 1 - weekDow) + (week - 1) * 7 + dow);
    return d0.toISOString().split("T")[0];
  }, [blockConfig?.startDate, sessions]);

  const syncWorkoutLogStatus = useCallback((sessId: string, week: number, status: "completed" | "planned", note?: string) => {
    if (!athleteId) return;
    const scheduledDate = sessionScheduledDate(sessId, week);
    if (!scheduledDate) return;
    const sess = sessions.find(s => s.id === sessId);

    (async () => {
      const { data: existing } = await supabase
        .from("workout_logs")
        .select("id")
        .eq("session_id", sessId)
        .eq("athlete_id", athleteId)
        .eq("scheduled_date", scheduledDate)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("workout_logs")
          .update(note != null ? { status, notes: note } : { status })
          .eq("id", existing.id);
      } else if (status === "completed") {
        await supabase
          .from("workout_logs")
          .insert({
            athlete_id:     athleteId,
            session_id:     sessId,
            session_name:   sess?.name ?? "Séance",
            scheduled_date: scheduledDate,
            status:         "completed",
            ...(note != null ? { notes: note } : {}),
          });
      }
      qc.invalidateQueries({ queryKey: ["cal", athleteId] });
    })();
  }, [sessionScheduledDate, sessions, athleteId, qc]);

  const completeSession = useCallback((sessId: string, week: number, note?: string) => {
    const prev = completedSessions[week] || [];
    if (prev.includes(sessId)) return;
    const newW = [...prev, sessId];
    const newC = { ...completedSessions, [week]: newW };
    setCompletedSessions(newC);
    if (newW.length >= (weeklyTarget[week] || goals.sessionsPerWeek)) {
      setWeekJustCompleted(week);
      setTimeout(() => { setWeekJustCompleted(null); if (week >= tw) setShowBilan(true); else setAW(week + 1); }, 2800);
    }
    syncWorkoutLogStatus(sessId, week, "completed", note);
  }, [completedSessions, weeklyTarget, goals.sessionsPerWeek, tw, setCompletedSessions, setWeekJustCompleted, setShowBilan, setAW, syncWorkoutLogStatus]);

  const uncompleteSession = useCallback((sessId: string, week: number) => {
    setCompletedSessions({ ...completedSessions, [week]: (completedSessions[week] || []).filter(s => s !== sessId) });
    syncWorkoutLogStatus(sessId, week, "planned");
  }, [completedSessions, setCompletedSessions, syncWorkoutLogStatus]);

  const archiveAndNewBlock = useCallback((opts: NewBlockOpts) => {
    const hasData = Object.values(exos).flat().length > 0 || Object.values(completedSessions).flat().length > 0;
    if (hasData) {
      const archived: ArchivedBlock = {
        id: "blk_" + Date.now(), archivedAt: new Date().toISOString(),
        exos, sets, completedSessions, sessions, blockConfig, goals,
        wellnessHistory, bodyWeight, athleteNotes: {},
      };
      setBlockHistory([...blockHistory, archived]);
    }
    setSessions(opts.sessions || []);
    if (opts.restoredExos) { setExos(opts.restoredExos); }
    else if (!opts.exos) { const ne: ExosMap = {}; (opts.sessions || []).forEach(s => { ne[s.id] = []; }); setExos(ne); }
    else { const ne = { ...exos }; (opts.sessions || []).forEach(s => { if (!ne[s.id]) ne[s.id] = []; }); setExos(ne); }
    const newBc = opts.config ? { ...blockConfig } : { totalWeeks: 6, deloadWeek: 0 };
    (newBc as BlockConfig).blockName = opts.blockName || "";
    (newBc as BlockConfig).objective = opts.objective || "";
    (newBc as BlockConfig).totalWeeks = opts.totalWeeks || 6;
    (newBc as BlockConfig).deloadWeek = opts.deloadWeek || 0;
    (newBc as BlockConfig).startDate = new Date().toISOString().slice(0, 10);
    setBlockConfig(newBc as BlockConfig);
    setGoals(g => ({ ...g, sessionsPerWeek: opts.sessPerWeek || g.sessionsPerWeek }));
    setSets({});
    setCompletedSessions({} as Record<number, string[]>);
    setAthleteNotes({});
    setWellness(null); save(SKEYS.wellness, null).catch(() => {});
    setWellnessHistory({}); save(SKEYS.wellnessHistory, {}).catch(() => {});
    setAW(1); setShowBilan(false);
  }, [exos, sets, completedSessions, sessions, blockConfig, goals, wellnessHistory, bodyWeight, blockHistory, setBlockHistory, setSessions, setExos, setBlockConfig, setGoals, setSets, setCompletedSessions, setAthleteNotes, setWellness, setWellnessHistory, setAW, setShowBilan, save]);

  const applyAIEdit = useCallback((newSessions: ExosMap) => {
    const merged = { ...exos };
    Object.entries(newSessions).forEach(([sid, exList]) => { merged[sid] = exList; });
    setExos(merged);
  }, [exos, setExos]);

  const saveWellness = useCallback((data: WellnessData) => {
    const dataWithDate = { ...data, date: todayKey() };
    setWellness(dataWithDate);
    const wh = { ...wellnessHistory, [todayKey()]: dataWithDate };
    setWellnessHistory(wh);
    if (data.poids) {
      const key = todayKey();
      const nwl = { ...weightLog, [key]: data.poids };
      setWeightLog(nwl);
      const milestone = checkMilestone(nwl, bodyWeight.current);
      if (milestone && milestone > bodyWeight.current) {
        const nm = [...weightMilestones, { date: key, kg: milestone }];
        setWeightMilestones(nm);
        const newBw = { ...bodyWeight, current: milestone };
        setBodyWeight(newBw);
        setMilestoneNotif(milestone);
        setTimeout(() => setMilestoneNotif(null), 3500);
      }
    }
  }, [wellnessHistory, weightLog, bodyWeight, weightMilestones, setWellness, setWellnessHistory, setWeightLog, setWeightMilestones, setBodyWeight, setMilestoneNotif]);

  const updateSessionDay = useCallback((sessId: string, dayIdx: number) => {
    setSessions(prev => prev.map(s => s.id === sessId ? { ...s, day_of_week: dayIdx } : s));
  }, [setSessions]);

  const updateSessionWeekDay = useCallback((sessId: string, blockWeek: number, dayIdx: number | null) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessId) return s;
      const wd = { ...(s.weekDays || {}) };
      if (dayIdx === null) wd[String(blockWeek)] = -1; else wd[String(blockWeek)] = dayIdx;
      return { ...s, weekDays: wd };
    }));
  }, [setSessions]);

  const addInjury = useCallback((inj: Injury) => setInjuries([...injuries, inj]), [injuries, setInjuries]);
  const updateInjury = useCallback((inj: Injury) => setInjuries(injuries.map(i => i.id === inj.id ? inj : i)), [injuries, setInjuries]);
  const deleteInjury = useCallback((id: string) => setInjuries(injuries.filter(i => i.id !== id)), [injuries, setInjuries]);

  const toggleHabitLog = useCallback(async (habitId: string, dateISO: string, habitLogs: Record<string, string[]>, setHabitLogs: (v: Record<string, string[]>) => void) => {
    const logs = habitLogs[habitId] || [];
    if (logs.includes(dateISO)) {
      await supabase.from('habit_logs').delete().match({ habit_id: habitId, date: dateISO });
      setHabitLogs({ ...habitLogs, [habitId]: (habitLogs[habitId] || []).filter(d => d !== dateISO) });
    } else {
      await supabase.from('habit_logs').insert({ habit_id: habitId, athlete_id: athleteId, date: dateISO });
      setHabitLogs({ ...habitLogs, [habitId]: [...(habitLogs[habitId] || []), dateISO] });
    }
  }, [athleteId]);

  const updSets = useCallback((k: string, ns: unknown[]) => setSets({ ...sets, [k]: ns as SetsMap[string] }), [sets, setSets]);

  return {
    completeSession, uncompleteSession,
    archiveAndNewBlock, applyAIEdit, saveWellness, updateSessionDay,
    updateSessionWeekDay, addInjury, updateInjury, deleteInjury, toggleHabitLog, updSets,
  };
}
