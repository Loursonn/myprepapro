import { useState, useEffect, useCallback } from "react";
import { SKEYS, sLoad, sSave } from "@/lib/storage";
import { DEF_SESSIONS, DEF_BLOCK_CONFIG } from "@/lib/exercises";
import { getNutritionStrategy } from "@/lib/nutrition";
import { todayKey } from "@/lib/date";
import type {
  ExosMap, SetsMap, Session, BlockConfig, WellnessData,
  BodyWeight, Goals, Injury, ArchivedBlock,
  VisibilitySettings, SessionLog, FreeSession, NutritionStrategy,
} from "../types/athlete";
import { supabase } from "@/integrations/supabase/client";

const DEF_VISIBILITY: VisibilitySettings = {
  muscu: true, energy: true, tests: true, wellness: true,
  nutrition: true, pr: true, weight: true,
};

export function useAthletePersistedState(athleteId: string) {
  const load = useCallback(<T>(k: string, fb: T) => sLoad<T>(k, fb, athleteId), [athleteId]);
  const save = useCallback((k: string, v: unknown) => sSave(k, v, athleteId), [athleteId]);

  const [exos, setExosRaw] = useState<ExosMap>({});
  const [exMeta, setExMetaRaw] = useState<Record<string, unknown>>({});
  const [sets, setSetsRaw] = useState<SetsMap>({});
  const [sessions, setSessionsRaw] = useState<Session[]>(DEF_SESSIONS as Session[]);
  const [blockConfig, setBlockConfigRaw] = useState<BlockConfig>(DEF_BLOCK_CONFIG as BlockConfig);
  const [completedSessions, setCompletedSessionsRaw] = useState<Record<number, string[]>>({});
  const [goals, setGoalsRaw] = useState<Goals>({ sessionsPerWeek: 6, sleepTarget: 8 });
  const [athleteNotes, setAthleteNotesRaw] = useState<Record<string, string>>({});
  const [customMethods, setCustomMethodsRaw] = useState<unknown[]>([]);
  const [weightLog, setWeightLogRaw] = useState<Record<string, number>>({});
  const [weightMilestones, setWeightMilestonesRaw] = useState<Array<{ date: string; kg: number }>>([]);
  const [injuries, setInjuriesRaw] = useState<Injury[]>([]);
  const [wellness, setWellnessRaw] = useState<WellnessData | null>(null);
  const [wellnessHistory, setWellnessHistoryRaw] = useState<Record<string, WellnessData>>({});
  const [bodyWeight, setBodyWeightRaw] = useState<BodyWeight>({ current: 0, target: 0 });
  const [blockHistory, setBlockHistoryRaw] = useState<ArchivedBlock[]>([]);
  const [weekSchedule, setWeekScheduleRaw] = useState<Record<string, unknown>>({});
  const [sessionLogs, setSessionLogsRaw] = useState<Record<string, SessionLog>>({});
  const [freeSessions, setFreeSessionsRaw] = useState<FreeSession[]>([]);
  const [nutritionStrategy, setNutritionStrategy] = useState<NutritionStrategy | null>(null);
  const [nutritionLog, setNutritionLogRaw] = useState<Record<string, unknown>>({});
  const [visibilitySettings, setVisibilityRaw] = useState<VisibilitySettings>(DEF_VISIBILITY);
  const [testSessions, setTestSessionsRaw] = useState<unknown[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "error" | null>(null);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [e, m, s, w, wh, bw, cs, g, an, cm, wl, wmil, inj, sess, bc, bh, ws, ns, nl, sl, fs] =
        await Promise.all([
          load<ExosMap>(SKEYS.exos, {}),
          load<Record<string, unknown>>(SKEYS.exMeta, {}),
          load<SetsMap>(SKEYS.sets, {}),
          load<WellnessData | null>(SKEYS.wellness, null),
          load<Record<string, WellnessData>>(SKEYS.wellnessHistory, {}),
          load<BodyWeight>(SKEYS.bw, { current: 0, target: 0 }),
          load<Record<number, string[]>>(SKEYS.completed, {}),
          load<Goals>(SKEYS.goals, { sessionsPerWeek: 6, sleepTarget: 8 }),
          load<Record<string, string>>(SKEYS.anotes, {}),
          load<unknown[]>(SKEYS.custMethods, []),
          load<Record<string, number>>(SKEYS.weightLog, {}),
          load<Array<{ date: string; kg: number }>>(SKEYS.weightMilestones, []),
          load<Injury[]>(SKEYS.injuries, []),
          load<Session[]>(SKEYS.sessions, DEF_SESSIONS as Session[]),
          load<BlockConfig>(SKEYS.blockConfig, DEF_BLOCK_CONFIG as BlockConfig),
          load<ArchivedBlock[]>(SKEYS.blockHistory, []),
          load<Record<string, unknown>>(SKEYS.weekSchedule, {}),
          getNutritionStrategy(athleteId).catch(() => null),
          load<Record<string, unknown>>("asp:nutrition_log", {}),
          load<Record<string, SessionLog>>(SKEYS.sessionLogs, {}),
          load<FreeSession[]>(SKEYS.freeSessions, []),
        ]);
      const todayW = w?.date === todayKey() ? w : null;
      if (w && !todayW) save(SKEYS.wellness, null).catch(() => {});
      setExosRaw(e); setExMetaRaw(m); setSetsRaw(s); setWellnessRaw(todayW);
      setWellnessHistoryRaw(wh); setBodyWeightRaw(bw); setCompletedSessionsRaw(cs);
      setGoalsRaw(g); setAthleteNotesRaw(an); setCustomMethodsRaw(cm);
      setWeightLogRaw(wl); setWeightMilestonesRaw(wmil); setInjuriesRaw(inj);
      setSessionsRaw(sess); setBlockConfigRaw(bc); setBlockHistoryRaw(bh || []);
      setWeekScheduleRaw(ws || {}); setNutritionStrategy(ns);
      setNutritionLogRaw(nl || {}); setSessionLogsRaw(sl); setFreeSessionsRaw(fs);
      setLoaded(true);
    })();
  }, [athleteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visibility settings + test sessions from Supabase ────────────────────
  useEffect(() => {
    if (!athleteId) return;
    supabase.from('test_sessions').select('id,type,title,date,completed')
      .eq('athlete_id', athleteId).order('date', { ascending: true })
      .then(({ data }) => { if (data) setTestSessionsRaw(data); });
    supabase.from('app_data').select('value')
      .eq('athlete_id', athleteId).eq('key', 'asp:visibility').maybeSingle()
      .then(({ data }) => { if (data?.value) setVisibilityRaw(v => ({ ...v, ...(data.value as VisibilitySettings) })); });
  }, [athleteId]);

  // ── Wellness midnight reset ────────────────────────────────────────────────
  useEffect(() => {
    if (!wellness) return;
    const now = new Date(); const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
    const tid = setTimeout(() => { setWellnessRaw(null); save(SKEYS.wellness, null).catch(() => {}); }, +midnight - +now);
    return () => clearTimeout(tid);
  }, [wellness]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save flash ────────────────────────────────────────────────────────────
  const flash = useCallback((ok: boolean) => {
    setSaveStatus(ok ? "saved" : "error");
    setTimeout(() => setSaveStatus(null), 2000);
  }, []);

  // ── Wrapped setters (persist on write) ────────────────────────────────────
  const setExos = useCallback((v: ExosMap | ((p: ExosMap) => ExosMap)) => {
    setExosRaw(prev => { const val = typeof v === 'function' ? v(prev) : v; save(SKEYS.exos, val).then(() => flash(true)).catch(() => flash(false)); return val; });
  }, [save, flash]);

  const setExMeta = useCallback((v: Record<string, unknown> | ((p: Record<string, unknown>) => Record<string, unknown>)) => {
    setExMetaRaw(prev => { const val = typeof v === 'function' ? v(prev) : v; save(SKEYS.exMeta, val).then(() => flash(true)).catch(() => flash(false)); return val; });
  }, [save, flash]);

  const setSets = useCallback((v: SetsMap) => { setSetsRaw(v); save(SKEYS.sets, v).catch(() => {}); }, [save]);
  const setBodyWeight = useCallback((v: BodyWeight) => { setBodyWeightRaw(v); save(SKEYS.bw, v).catch(() => {}); }, [save]);

  const setGoals = useCallback((v: Goals | ((p: Goals) => Goals)) => {
    setGoalsRaw(prev => { const val = typeof v === 'function' ? v(prev) : v; save(SKEYS.goals, val).then(() => flash(true)).catch(() => flash(false)); return val; });
  }, [save, flash]);

  const setCompletedSessions = useCallback((v: Record<number, string[]>) => { setCompletedSessionsRaw(v); save(SKEYS.completed, v).catch(() => {}); }, [save]);
  const setAthleteNotes = useCallback((v: Record<string, string>) => { setAthleteNotesRaw(v); save(SKEYS.anotes, v).catch(() => {}); }, [save]);

  const setCustomMethods = useCallback((v: unknown[]) => {
    setCustomMethodsRaw(v); save(SKEYS.custMethods, v).then(() => flash(true)).catch(() => flash(false));
  }, [save, flash]);

  const setSessions = useCallback((v: Session[] | ((p: Session[]) => Session[])) => {
    setSessionsRaw(prev => { const val = typeof v === 'function' ? v(prev) : v; save(SKEYS.sessions, val).then(() => flash(true)).catch(() => flash(false)); return val; });
  }, [save, flash]);

  const setBlockConfig = useCallback((v: BlockConfig | ((p: BlockConfig) => BlockConfig)) => {
    setBlockConfigRaw(prev => { const val = typeof v === 'function' ? v(prev) : v; save(SKEYS.blockConfig, val).then(() => flash(true)).catch(() => flash(false)); return val; });
  }, [save, flash]);

  const setBlockHistory = useCallback((v: ArchivedBlock[]) => {
    setBlockHistoryRaw(v); save(SKEYS.blockHistory, v).then(() => flash(true)).catch(() => flash(false));
  }, [save, flash]);

  const setWeekSchedule = useCallback((v: Record<string, unknown>) => { setWeekScheduleRaw(v); save(SKEYS.weekSchedule, v).catch(() => {}); }, [save]);
  const setSessionLogs = useCallback((v: Record<string, SessionLog>) => { setSessionLogsRaw(v); save(SKEYS.sessionLogs, v).catch(() => {}); }, [save]);
  const setFreeSessions = useCallback((v: FreeSession[] | ((prev: FreeSession[]) => FreeSession[])) => {
    setFreeSessionsRaw(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      save(SKEYS.freeSessions, next).catch(() => {});
      return next;
    });
  }, [save]);

  const setNutritionLog = useCallback((v: Record<string, unknown>) => {
    setNutritionLogRaw(v); save("asp:nutrition_log", v).catch(() => {});
  }, [save]);

  const setVisibilitySettings = useCallback(async (settings: VisibilitySettings) => {
    setVisibilityRaw(settings);
    await supabase.from('app_data').upsert(
      { athlete_id: athleteId, key: 'asp:visibility', value: settings, updated_at: new Date().toISOString() },
      { onConflict: 'athlete_id,key' },
    );
  }, [athleteId]);

  const setWellness = useCallback((v: WellnessData | null) => {
    setWellnessRaw(v); save(SKEYS.wellness, v).catch(() => {});
  }, [save]);

  const setWellnessHistory = useCallback((v: Record<string, WellnessData>) => {
    setWellnessHistoryRaw(v); save(SKEYS.wellnessHistory, v).catch(() => {});
  }, [save]);

  const setWeightLog = useCallback((v: Record<string, number>) => {
    setWeightLogRaw(v); save(SKEYS.weightLog, v).catch(() => {});
  }, [save]);

  const setWeightMilestones = useCallback((v: Array<{ date: string; kg: number }>) => {
    setWeightMilestonesRaw(v); save(SKEYS.weightMilestones, v).catch(() => {});
  }, [save]);

  const setInjuries = useCallback((v: Injury[]) => { setInjuriesRaw(v); save(SKEYS.injuries, v).catch(() => {}); }, [save]);

  return {
    // Raw state (read)
    exos, exMeta, sets, sessions, blockConfig, completedSessions, goals,
    athleteNotes, customMethods, weightLog, weightMilestones, injuries,
    wellness, wellnessHistory, bodyWeight, blockHistory, weekSchedule,
    sessionLogs, freeSessions, nutritionStrategy, setNutritionStrategy,
    nutritionLog, visibilitySettings, testSessions, setTestSessions: setTestSessionsRaw,
    loaded, saveStatus,
    // Wrapped setters (write + persist)
    setExos, setExMeta, setSets, setBodyWeight, setGoals, setCompletedSessions,
    setAthleteNotes, setCustomMethods, setSessions, setBlockConfig, setBlockHistory,
    setWeekSchedule, setSessionLogs, setFreeSessions, setNutritionLog,
    setVisibilitySettings, setWellness, setWellnessHistory,
    setWeightLog, setWeightMilestones, setInjuries,
    // Internal raw setters needed by logic hooks
    _setBodyWeightRaw: setBodyWeightRaw,
    _setWeightLogRaw: setWeightLogRaw,
    _setWeightMilestonesRaw: setWeightMilestonesRaw,
    _setWellnessRaw: setWellnessRaw,
    _setWellnessHistoryRaw: setWellnessHistoryRaw,
    _setSetsRaw: setSetsRaw,
    _setCompletedSessionsRaw: setCompletedSessionsRaw,
    _setAthleteNotesRaw: setAthleteNotesRaw,
  };
}
