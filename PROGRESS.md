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

## 📱 PROMPT 4 - Refonte vue athlète mobile
- [ ] Bottom tabs réduites à 3 (Aujourd'hui, Programme, Profil)
- [ ] Page Aujourd'hui créée (route /)
- [ ] Section Greeting + Readiness Score (cercle 0-100)
- [ ] Calcul readiness implémenté (formule pondérée)
- [ ] Couleurs score (rouge <50, orange 50-70, vert >70)
- [ ] BottomSheet wellness logger (shadcn Drawer)
- [ ] Section séance du jour (CTA "Démarrer")
- [ ] Section récap hier
- [ ] Section prochaine compétition
- [ ] Mini-graphes (charge 7j, wellness 14j)
- [ ] Page Programme créée (route /program)
- [ ] Sélecteur semaine (← →)
- [ ] Liste 7 jours cliquable
- [ ] Détail séance route /program/workout/:id
- [ ] Édition séries (sets/reps/poids/RIR)
- [ ] Bouton "Terminer la séance" sticky
- [ ] Page Profil créée (route /profil)
- [ ] Sections : infos, stats complètes, PR, paramètres
- [ ] useTodayWorkout() créé
- [ ] useTodayWellness() créé
- [ ] useUpcomingCompetition() créé
- [ ] useWeekProgram() créé
- [ ] useWorkoutDetail() créé
- [ ] useReadinessScore() créé
- [ ] useLogWellness mutation optimistic
- [ ] useUpdateSet mutation optimistic + debounce 500ms
- [ ] useCompleteWorkout mutation
- [ ] Pull-to-refresh sur Aujourd'hui
- [ ] Haptic feedback sur CTAs (vibrate)
- [ ] Toast position top-center mobile
- [ ] Design mobile-first max-w-[480px]
- [ ] npm run build passe
- [ ] npm run lint passe
- [ ] ✅ **TEST MANUEL** : Today interactif, wellness log fonctionne, séance complétable

---

## ⌨️ PROMPT 5 - Command palette + finitions
- [ ] cmdk installé + shadcn Command configuré
- [ ] CommandPaletteProvider créé
- [ ] Raccourci Cmd+K / Ctrl+K fonctionnel
- [ ] Groupe Athlètes (fuzzy search)
- [ ] Groupe Navigation
- [ ] Groupe Actions rapides
- [ ] Groupe Récents (5 dernières pages)
- [ ] useCommandPalette() hook créé
- [ ] Listener global keydown
- [ ] Skeletons créés : PageSkeleton, CardSkeleton, TableSkeleton, ChartSkeleton, ListSkeleton
- [ ] Tous les "Loading..." remplacés par skeletons
- [ ] Audit useMutation fait
- [ ] Optimistic updates implémentés (onMutate + rollback onError)
- [ ] sonner configuré (position bottom-right desktop, top-center mobile)
- [ ] Tous alert() remplacés par toasts
- [ ] EmptyState component créé
- [ ] Empty states appliqués partout
- [ ] StatusPill component créé (planned, in-progress, completed, missed, skipped)
- [ ] StatusPills utilisés partout
- [ ] Transitions hover/active 150ms appliquées
- [ ] framer-motion AnimatePresence sur routes
- [ ] npm run build passe
- [ ] npm run lint passe
- [ ] CONTRIBUTING.md créé (conventions skeletons, toasts, mutations)
- [ ] ✅ **TEST MANUEL** : Cmd+K ouvre palette, optimistic updates réagissent <50ms, UI fluide

---

## 🗄️ PROMPT 6 - Migration DB / RLS Supabase
- [ ] DB_AUDIT.md créé (tables, RLS, manques)
- [ ] Indexes manquants identifiés
- [ ] Requêtes N+1 identifiées
- [ ] Migration A - Indexes créée et testée
- [ ] Migration B - Status workouts créée (colonne + backfill)
- [ ] Migration C - RPC get_coach_overview créée
- [ ] Migration D - RPC readiness_score (si serveur) OU skip
- [ ] Migration E - RLS audit + corrections
- [ ] Migration F - Cron mark-missed-workouts créé
- [ ] Types TS régénérés (database.types.ts)
- [ ] useCoachOverview adapté pour appeler RPC
- [ ] Mutations adaptées (.select().single())
- [ ] useRealtimeWorkoutStatus créé (si nécessaire)
- [ ] Tests SQL créés (supabase/tests/)
- [ ] Tests RLS coach/athlète passent
- [ ] DB_MIGRATIONS.md créé (ordre, rollback, déploiement)
- [ ] Backup DB Supabase fait
- [ ] Migrations testées sur projet staging Supabase
- [ ] npm run build passe
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

**Dernière mise à jour :** 2026-04-27 — PROMPT 2 en cours
