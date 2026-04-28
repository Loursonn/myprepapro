/**
 * Centralized React Query key factory.
 * All keys are typed tuples so cache invalidation is safe to refactor.
 */
export const QK = {
  habits:              (aid: string) => ['habits', aid]              as const,
  habitLogs:           (aid: string) => ['habitLogs', aid]           as const,
  testSessions:        (aid: string) => ['testSessions', aid]        as const,
  energySessions:      (aid: string) => ['energySessions', aid]      as const,
  energyPlan:          (aid: string) => ['energyPlan', aid]          as const,
  nutritionStrategy:   (aid: string) => ['nutritionStrategy', aid]   as const,
  coachFeedback:       (aid: string) => ['coachFeedback', aid]       as const,
  appFeedback:         (aid: string) => ['appFeedback', aid]         as const,
  visibility:          (aid: string) => ['visibility', aid]          as const,
  athleteData:         (aid: string) => ['athleteData', aid]         as const,
} as const;
