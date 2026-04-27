# PROGRESS.md - Refonte MyPrepaPro

Coche [x] au fur et à mesure. Ne coche QUE ce qui est 100% terminé et testé.

---

## ✅ PROMPT 0 - Audit préparatoire
- [x] AUDIT.md créé avec analyse complète du monolithe
- [x] Liste des sous-sections identifiées
- [x] Hooks React Query recensés
- [x] États locaux mappés
- [x] Dépendances entre sections documentées
- [x] Duplications de code identifiées
- [x] Aucune modification de code (audit uniquement)

---

## ✅ PROMPT 1 - Split du monolithe
- [x] Structure features/ créée (coach, athlete, shared)
- [x] CoachLayout.tsx créé avec sidebar + Outlet
- [x] Pages coach créées (Prog, Banque, Stats, Données, Test, Retours)
- [x] AthleteLayout.tsx créé avec bottom tabs + Outlet
- [x] Pages athlete créées (Dashboard, LogSeance, Stats, Paramètres)
- [x] Composants partagés extraits dans shared/components/
- [x] Hooks React Query centralisés dans shared/hooks/
- [x] Types TypeScript définis dans shared/types/
- [x] React Router v6 configuré avec lazy loading
- [x] queryKeys centralisés dans lib/queryKeys.ts
- [x] Routes coach opérationnelles (/coach/*)
- [x] Routes athlete opérationnelles (/, /log, /stats, /params)
- [x] WeightliftingTracker.jsx SUPPRIMÉ
- [x] npm run build passe sans erreur
- [x] npm run lint passe sans warning bloquant
- [x] REFACTOR_NOTES.md créé avec détail des modifications
- [ ] ✅ **TEST MANUEL** : toutes les routes existantes fonctionnent

---

## ✅ PROMPT 2 - Refonte nav coach
- [x] Sidebar gauche créée (240px, collapsible 64px)
- [x] Items sidebar : Home, Athlètes, Banque, Tests, Paramètres
- [x] ContextBar sticky créée (athlète sélectionné)
- [x] Tabs secondaires : Planning, Stats, Données, Retours, Tests
- [x] Routes /coach/athletes/:athleteId/* créées
- [x] SelectedAthleteContext créé et Provider configuré
- [x] Planning page avec 4 niveaux de zoom (Saison, Bloc, Semaine, Jour)
- [x] State ?view dans URL (useSearchParams)
- [x] Redirections configurées (/coach → Home, etc.)
- [x] Skeleton loaders shadcn ajoutés (PlanningPage + ContextBar)
- [x] Toast sonner configuré pour mutations
- [x] Design tokens appliqués (#08090C, #7B6FFF, #D4538E)
- [x] Mobile coach responsive (sidebar auto-collapse <1024px)
- [x] npm run build passe
- [x] npm run lint passe
- [x] REFACTOR_NOTES.md mis à jour
- [ ] ✅ **TEST MANUEL** : navigation coach fluide, contexte athlète conservé

---

## ✅ PROMPT 3 - Home coach (dashboard)
- [x] HomePage.tsx créée (route /coach)
- [x] Row 1 - 4 KPICards (athlètes actifs, ratio séances, wellness moyen, compétitions)
- [x] Row 2 gauche - Alertes "À traiter" (surcharge, manquées, PR)
- [x] Row 2 droite - Alertes "À venir" (compétitions, athlètes sans planning)
- [x] Row 3 - ActivityTimeline (10 dernières actions)
- [x] useCoachOverview() créé
- [x] useOverloadedAthletes() créé
- [x] useMissedWorkouts() créé
- [x] useUpcomingCompetitions() créé
- [x] useRecentActivity() créé
- [x] KPICard component créé
- [x] AlertCard component créé
- [x] ActivityTimeline component créé
- [x] Empty states pour chaque section
- [x] Skeletons pendant chargement
- [x] Clics sur cards → navigation vers sous-routes
- [x] Date locale française (date-fns fr)
- [x] npm run build passe
- [x] npm run lint passe
- [ ] ✅ **TEST MANUEL** : Home affiche les bonnes données, clics fonctionnent

---

## 🔨 PROMPT 4 - Refonte vue athlète mobile
- [x] Bottom tabs réduites à 3 (Aujourd'hui, Programme, Profil)
- [x] Page Aujourd'hui créée (route /)
- [x] Section Greeting + Readiness Score (cercle 0-100)
- [x] Calcul readiness implémenté (formule pondérée)
- [x] Couleurs score (rouge <50, orange 50-70, vert >70)
- [x] BottomSheet wellness logger (shadcn Drawer)
- [x] Section séance du jour (CTA "Démarrer")
- [x] Section récap hier
- [x] Section prochaine compétition
- [x] Mini-graphes (charge 7j, wellness 14j)
- [x] Page Programme créée (route /program)
- [x] Sélecteur semaine (← →)
- [x] Liste 7 jours cliquable
- [x] Détail séance route /program/workout/:id
- [x] Édition séries (sets/reps/poids/RIR)
- [x] Bouton "Terminer la séance" sticky
- [x] Page Profil créée (route /profil)
- [x] Sections : infos, stats complètes, PR, paramètres
- [x] useTodayWorkout() créé
- [x] useTodayWellness() créé
- [x] useUpcomingCompetition() créé
- [x] useWeekProgram() créé
- [x] useWorkoutDetail() créé
- [x] useReadinessScore() créé
- [x] useLogWellness mutation optimistic
- [x] useUpdateSet mutation optimistic + debounce 500ms
- [x] useCompleteWorkout mutation
- [x] Pull-to-refresh sur Aujourd'hui (navigator.vibrate haptic + scroll natif)
- [x] Haptic feedback sur CTAs (vibrate)
- [x] Toast position top-center mobile (sonner configuré)
- [x] Design mobile-first max-w-[480px]
- [x] npm run build passe
- [x] npm run lint passe
- [ ] ✅ **TEST MANUEL** : Today interactif, wellness log fonctionne, séance complétable

---

## ⌨️ PROMPT 5 - Command palette + finitions
- [x] cmdk installé + shadcn Command configuré
- [x] CommandPaletteProvider créé
- [x] Raccourci Cmd+K / Ctrl+K fonctionnel
- [x] Groupe Athlètes (fuzzy search)
- [x] Groupe Navigation
- [x] Groupe Actions rapides
- [x] Groupe Récents (5 dernières pages)
- [x] useCommandPalette() hook créé
- [x] Listener global keydown
- [x] Skeletons créés : PageSkeleton, CardSkeleton, TableSkeleton, ChartSkeleton, ListSkeleton
- [x] Tous les "Loading..." remplacés par skeletons
- [x] Audit useMutation fait
- [x] Optimistic updates implémentés (onMutate + rollback onError)
- [x] sonner configuré (position bottom-right desktop, top-center mobile)
- [x] Tous alert() remplacés par toasts
- [x] EmptyState component créé
- [x] Empty states appliqués partout
- [x] StatusPill component créé (planned, in-progress, completed, missed, skipped)
- [x] StatusPills utilisés partout
- [x] Transitions hover/active 150ms appliquées
- [x] framer-motion AnimatePresence sur routes
- [x] npm run build passe
- [x] npm run lint passe
- [x] CONTRIBUTING.md créé (conventions skeletons, toasts, mutations)
- [ ] ✅ **TEST MANUEL** : Cmd+K ouvre palette, optimistic updates réagissent <50ms, UI fluide

---

## 🗄️ PROMPT 6 - Migration DB / RLS Supabase
- [x] DB_AUDIT.md créé (tables, RLS, manques)
- [x] Indexes manquants identifiés
- [x] Requêtes N+1 identifiées
- [x] Migration A - Indexes créée et testée
- [x] Migration B - Status workouts créée (colonne + backfill)
- [x] Migration C - RPC get_coach_overview créée
- [x] Migration D - RPC readiness_score (si serveur) OU skip
- [x] Migration E - RLS audit + corrections
- [x] Migration F - Cron mark-missed-workouts créé
- [x] Types TS régénérés (database.types.ts)
- [x] useCoachOverview adapté pour appeler RPC
- [x] Mutations adaptées (.select().single())
- [x] useRealtimeWorkoutStatus créé (si nécessaire)
- [x] Tests SQL créés (supabase/tests/)
- [ ] Tests RLS coach/athlète passent
- [x] DB_MIGRATIONS.md créé (ordre, rollback, déploiement)
- [ ] Backup DB Supabase fait
- [ ] Migrations testées sur projet staging Supabase
- [x] npm run build passe
- [ ] ✅ **TEST MANUEL** : données coach OK, RLS respectées, pas d'accès croisé

---

## 🎉 VALIDATION FINALE
- [ ] Tous les prompts 0-6 cochés à 100%
- [ ] Aucune erreur console sur aucune page
- [ ] Flow coach complet testé (login → home → athlète → planning → édition → retour)
- [ ] Flow athlète complet testé (login → wellness → séance → terminer)
- [ ] Test mobile réel (pas juste DevTools) sur iPhone/Android
- [ ] Performance : FCP <1s sur Today athlète (4G simulé)
- [ ] Lighthouse audit >90 sur Performance + Accessibility
- [ ] Déployé sur environnement de staging
- [ ] Tests utilisateurs avec 1 coach + 1 athlète réels
- [ ] Retours bugs/UX documentés
- [ ] Fix appliqués
- [ ] Prêt pour prod

---

**Dernière mise à jour :** 2026-04-27 — PROMPT 5 terminé (TEST MANUEL restant)
