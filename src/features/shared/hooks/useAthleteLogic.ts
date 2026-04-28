import { useCallback, useEffect, useRef } from "react";
import { e1rm, roundHalf, parseReps, DEF_TIER_CONFIG, getExTier } from "@/lib/exercises";
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
  setAutoProgNotif: (v: string | null) => void;
  setMilestoneNotif: (v: number | null) => void;
  setWeekJustCompleted: (v: number | null) => void;
  setShowBilan: (v: boolean) => void;
  setAW: (v: number) => void;
  save: (k: string, v: unknown) => Promise<void>;
}

export function useAthleteLogic(d: LogicDeps) {
  const {
    athleteId, exos, sets, sessions, blockConfig, goals, completedSessions,
    wellnessHistory, bodyWeight, weightLog, weightMilestones, injuries, blockHistory,
    tw, dw, weeksArr, weeklyTarget, loaded,
    setExos, setSets, setSessions, setBlockConfig, setGoals, setCompletedSessions,
    setAthleteNotes, setBlockHistory, setWellness, setWellnessHistory,
    setWeightLog, setWeightMilestones, setBodyWeight, setInjuries,
    setAutoProgNotif, setMilestoneNotif, setWeekJustCompleted, setShowBilan, setAW, save,
  } = d;

  // ── Auto progress computation (pure) ──────────────────────────────────────
  const computeAutoProgress = useCallback((sessId: string, completedWeek: number, srcExos?: ExosMap): ExosMap | null => {
    const curExos = srcExos ?? exos;
    const sessExos = curExos[sessId] || [];
    if (!sessExos.length) return null;
    const tierCfgL = blockConfig?.tierConfig || DEF_TIER_CONFIG;
    const dwL = blockConfig?.deloadWeek || tw;
    const futureWeeks = weeksArr.filter(w => w > completedWeek);
    const futureTrainWeeks = futureWeeks.filter(w => w !== dwL);
    if (!futureWeeks.length) return null;
    let changed = false;
    const newSessExos = sessExos.map(ex => {
      const eType = ex.exType || (ex.isFlexibility ? "mobilite" : "muscu");
      if (eType !== "muscu" && eType !== "halterophilie") return ex;
      const doneRows = (sets[ex.id + "_" + completedWeek] || []).filter(r => r.done);
      if (!doneRows.length) return ex;
      const tier = getExTier(ex.name, ex);
      const tc = (tierCfgL as Record<number, typeof DEF_TIER_CONFIG[number]>)[tier] || (tierCfgL as Record<number, typeof DEF_TIER_CONFIG[number]>)[3];
      const plannedWd = ex.weeks[completedWeek] || {};
      const mainRows = doneRows.filter(r => !r.type || r.type === "set");
      const refRows = mainRows.length ? mainRows : doneRows;
      const kgVals = refRows.map(r => r.kg || 0).filter(v => v > 0);
      const baseKg = kgVals.length ? kgVals[Math.floor(kgVals.length / 2)] : (plannedWd.pdc ? 0 : (plannedWd.kg || 0));
      const basePdc = !!(plannedWd.pdc && !baseKg);
      const repsVals = mainRows.filter(r => (r.reps ?? 0) > 0).map(r => r.reps!);
      const baseReps = repsVals.length ? Math.round(repsVals.reduce((a, b) => a + b, 0) / repsVals.length) : (parseReps(plannedWd.repsRange ?? "") || 10);
      const rirVals = mainRows.map(r => r.rir).filter((v): v is number => v != null && !isNaN(v));
      const baseRir = rirVals.length ? Math.round(rirVals.reduce((a, b) => a + b, 0) / rirVals.length * 2) / 2 : (plannedWd.rir ?? tc.rirStart ?? 2);
      const baseSets = mainRows.length || plannedWd.sets || 3;
      const newWeeks = { ...ex.weeks };
      futureWeeks.forEach(w => {
        if ((completedSessions[w] || []).includes(sessId)) return;
        const existingWd = newWeeks[w] || {};
        const preserve = { coachNote: existingWd.coachNote, tempo: existingWd.tempo, method: existingWd.method, methodParams: existingWd.methodParams };
        const kgBase = basePdc ? undefined : baseKg;
        if (w === dwL) {
          const dlPct = tc.deloadPct || 40;
          newWeeks[w] = { ...preserve, ...(basePdc ? { pdc: true } : (kgBase ? { kg: Math.round(kgBase * (1 - dlPct / 100) / 2.5) * 2.5 } : {})), sets: Math.max(2, Math.round(baseSets * 0.6)), rir: (tc.rirStart || 2) + 2, repsRange: String(baseReps) };
        } else {
          const wIdx = futureTrainWeeks.indexOf(w);
          const total = futureTrainWeeks.length;
          const kgStep = tc.kgStep ?? 2.5;
          if (tc.mode === "rir") {
            const rirDrop = baseRir >= (tc.rirEnd ?? 0) ? Math.max(0, baseRir - (tc.rirEnd ?? 0)) / Math.max(1, total) : 0;
            const newRir = Math.max(tc.rirEnd ?? 0, Math.round((baseRir - rirDrop * (wIdx + 1)) * 2) / 2);
            newWeeks[w] = { ...preserve, ...(basePdc ? { pdc: true } : (kgBase ? { kg: roundHalf(kgBase + kgStep * (wIdx + 1)) } : {})), sets: baseSets, repsRange: String(baseReps), rir: newRir };
          } else if (tc.mode === "reps") {
            const repTarget = tc.repsEnd || 12;
            const repGap = Math.max(0, repTarget - baseReps);
            const repStep = total ? Math.ceil(repGap / total) : 0;
            const newReps = Math.min(repTarget, baseReps + repStep * (wIdx + 1));
            const rirDrop = (baseRir - (tc.rirEnd || 1)) / Math.max(1, total);
            const newRir = Math.max(tc.rirEnd || 1, Math.round((baseRir - rirDrop * (wIdx + 1)) * 2) / 2);
            const cycleLen = repGap + 1 || 1;
            const cycleNum = Math.floor((wIdx + 1) / cycleLen);
            newWeeks[w] = { ...preserve, ...(basePdc ? { pdc: true } : (kgBase ? { kg: roundHalf(kgBase + kgStep * cycleNum) } : {})), sets: baseSets, repsRange: String(newReps), rir: newRir };
          } else {
            newWeeks[w] = { ...preserve, ...(basePdc ? { pdc: true } : (kgBase ? { kg: roundHalf(kgBase + kgStep * (wIdx + 1)) } : {})), sets: baseSets, repsRange: String(baseReps), rir: tc.rir ?? 0 };
          }
        }
        changed = true;
      });
      return { ...ex, weeks: newWeeks };
    });
    if (!changed) return null;
    return { ...curExos, [sessId]: newSessExos };
  }, [exos, sets, blockConfig, completedSessions, tw, weeksArr]);

  const autoProgressOnComplete = useCallback((sessId: string, completedWeek: number, currentExos?: ExosMap) => {
    const newExos = computeAutoProgress(sessId, completedWeek, currentExos ?? exos);
    if (newExos) {
      setExos(newExos);
      setAutoProgNotif(`Progression S${completedWeek + 1}→S${tw} mise à jour`);
      setTimeout(() => setAutoProgNotif(null), 3500);
    }
  }, [computeAutoProgress, exos, setExos, setAutoProgNotif, tw]);

  // ── Sync auto-progress on load ────────────────────────────────────────────
  // Guard: only run once per mount cycle — not on every remount (e.g. navigation)
  const autoSyncDoneRef = useRef(false);
  useEffect(() => {
    // Reset guard when component unmounts so next mount gets a fresh sync
    return () => { autoSyncDoneRef.current = false; };
  }, []);
  useEffect(() => {
    if (!loaded || autoSyncDoneRef.current) return;
    autoSyncDoneRef.current = true;
    let current = exos; let anyChanged = false;
    weeksArr.forEach(week => {
      sessions.forEach(s => {
        const hasActual = (current[s.id] || []).some(ex => (sets[ex.id + "_" + week] || []).some(r => r.done && (r.kg || 0) > 0));
        if (!hasActual) return;
        const result = computeAutoProgress(s.id, week, current);
        if (result) { current = result; anyChanged = true; }
      });
    });
    if (anyChanged) { setExos(current); setAutoProgNotif('Progression synchronisée depuis le réel'); setTimeout(() => setAutoProgNotif(null), 3500); }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const completeSession = useCallback((sessId: string, week: number) => {
    const prev = completedSessions[week] || [];
    if (prev.includes(sessId)) return;
    const newW = [...prev, sessId];
    const newC = { ...completedSessions, [week]: newW };
    setCompletedSessions(newC);
    autoProgressOnComplete(sessId, week);
    if (newW.length >= (weeklyTarget[week] || goals.sessionsPerWeek)) {
      setWeekJustCompleted(week);
      setTimeout(() => { setWeekJustCompleted(null); if (week >= tw) setShowBilan(true); else setAW(week + 1); }, 2800);
    }
  }, [completedSessions, weeklyTarget, goals.sessionsPerWeek, tw, setCompletedSessions, autoProgressOnComplete, setWeekJustCompleted, setShowBilan, setAW]);

  const uncompleteSession = useCallback((sessId: string, week: number) => {
    setCompletedSessions({ ...completedSessions, [week]: (completedSessions[week] || []).filter(s => s !== sessId) });
  }, [completedSessions, setCompletedSessions]);

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
    computeAutoProgress, autoProgressOnComplete, completeSession, uncompleteSession,
    archiveAndNewBlock, applyAIEdit, saveWellness, updateSessionDay,
    updateSessionWeekDay, addInjury, updateInjury, deleteInjury, toggleHabitLog, updSets,
  };
}
