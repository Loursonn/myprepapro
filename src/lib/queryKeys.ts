/**
 * Centralized React Query key factory.
 * All keys are typed tuples so cache invalidation is safe to refactor.
 */
export const QK = {
  habits:               (aid: string) => ['habits', aid]               as const,
  habitLogs:            (aid: string) => ['habitLogs', aid]            as const,
  testSessions:         (aid: string) => ['testSessions', aid]         as const,
  energySessions:       ['energy-sessions']                            as const,
  energySession:        (id: string)  => ['energy-sessions', id]       as const,
  energyAssignments:    (aid: string) => ['energy-assignments', aid]   as const,
  nutritionStrategy:    (aid: string) => ['nutritionStrategy', aid]    as const,
  coachFeedback:        (aid: string) => ['coachFeedback', aid]        as const,
  appFeedback:          (aid: string) => ['appFeedback', aid]          as const,
  visibility:           (aid: string) => ['visibility', aid]           as const,
  athleteData:          (aid: string) => ['athleteData', aid]          as const,
  // ── Tests énergétiques structurés ────────────────────────────────────────
  testDefinitions:      (cid: string) => ['testDefinitions', cid]      as const,
  athleteTestResults:   (aid: string) => ['athleteTestResults', aid]   as const,
  athleteCurrentValues: (aid: string) => ['athleteCurrentValues', aid] as const,
} as const;
