# REFACTOR_NOTES — Split du monolithe WeightliftingTracker

## Ce qui a changé

### Fichiers supprimés
- `src/components/WeightliftingTracker.jsx` (~1 300 lignes) — monolithe extrait
- `src/pages/athlete/Dashboard.tsx` — wrapper dead code (remplacé par AthleteApp)

### Nouvelle structure

```
src/
├── App.tsx                          # Routes imbriquées + lazy loading
├── features/
│   ├── athlete/
│   │   ├── AthleteLayout.tsx        # Header sticky + bottom tabs + modals globaux
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx    # /athlete
│   │   │   ├── LogSeancePage.tsx    # /athlete/log
│   │   │   ├── AlimPage.tsx         # /athlete/alim
│   │   │   └── AthleteTestPage.tsx  # /athlete/test
│   │   └── components/
│   │       ├── ProfileDrawer.tsx    # Drawer profil athlète (extrait du monolithe)
│   │       └── AppFbForm.tsx        # Formulaire feedback app (anti-pattern fixé)
│   ├── coach/
│   │   ├── CoachLayout.tsx          # Sidebar responsive + Outlet
│   │   ├── pages/
│   │   │   ├── ProgPage.tsx         # /coach/:id/prog
│   │   │   ├── BanquePage.tsx       # /coach/:id/banque
│   │   │   ├── StatsPage.tsx        # /coach/:id/stats
│   │   │   ├── DonneesPage.tsx      # /coach/:id/donnees
│   │   │   ├── TestPage.tsx         # /coach/:id/test
│   │   │   └── RetoursPage.tsx      # /coach/:id/retours
│   │   └── components/
│   │       ├── DataManager.tsx      # Suppression sélective de données
│   │       └── BlockHistoryViewer.tsx
│   └── shared/
│       ├── context/
│       │   └── AthleteContext.tsx   # Provider unique coach + athlète
│       ├── hooks/
│       │   ├── useAthletePersistedState.ts  # Chargement/sauvegarde Supabase
│       │   ├── useAthleteComputations.ts    # useMemo dérivés (currentWeek, prs…)
│       │   ├── useAthleteLogic.ts           # completeSession, archiveAndNewBlock…
│       │   ├── useEnergySessions.ts
│       │   ├── useHabits.ts
│       │   └── useFeedbacks.ts
│       └── types/
│           └── athlete.ts           # Types partagés (Session, BlockConfig…)
├── lib/
│   └── queryKeys.ts                 # Clés React Query centralisées (QK.*)
└── pages/
    ├── athlete/
    │   └── AthleteApp.tsx           # Wrapper AthleteProvider → AthleteLayout
    └── coach/
        ├── Dashboard.tsx            # Sélection d'athlète (/coach)
        └── CoachAthleteView.tsx     # Wrapper AthleteProvider → CoachLayout
```

## Routing

| Route | Composant | viewOnly |
|-------|-----------|----------|
| `/athlete` | AthleteApp → DashboardPage | false |
| `/athlete/log` | AthleteApp → LogSeancePage | false |
| `/athlete/alim` | AthleteApp → AlimPage | false |
| `/athlete/test` | AthleteApp → AthleteTestPage | false |
| `/coach` | CoachDashboard (sélection) | — |
| `/coach/:athleteId/prog` | CoachAthleteView → ProgPage | true si autre athlète |
| `/coach/:athleteId/banque` | CoachAthleteView → BanquePage | idem |
| `/coach/:athleteId/stats` | CoachAthleteView → StatsPage | idem |
| `/coach/:athleteId/donnees` | CoachAthleteView → DonneesPage | idem |
| `/coach/:athleteId/test` | CoachAthleteView → TestPage | idem |
| `/coach/:athleteId/retours` | CoachAthleteView → RetoursPage | idem |

## Contexte partagé

`AthleteProvider` est le seul provider de données. Il est instancié :
- dans `AthleteApp` avec `athleteId = user.id`, `viewOnly = false`
- dans `CoachAthleteView` avec `athleteId` depuis l'URL, `viewOnly = !isOwnView`

Toutes les pages lisent les données via `useAthleteContext()`.

## Anti-patterns résolus

| Avant | Après |
|-------|-------|
| `AppFbForm` défini dans le render du monolithe | Extrait dans `features/athlete/components/AppFbForm.tsx` |
| Navigation par `useState` (tab, coachTab…) | React Router v6 avec routes imbriquées |
| `setActiveAthleteId` dans `useAuth` pour switcher | `navigate('/coach/:id')` → URL source de vérité |
| ~60 `useState` dans un seul composant | Contexte + 6 hooks spécialisés |
| Aucun lazy loading | `React.lazy` + `Suspense` sur tous les layouts/pages |

---

## PROMPT 2 — Refonte nav coach (2026-04-27)

### Nouveaux fichiers

| Fichier | Rôle |
|---------|------|
| `src/features/coach/CoachShell.tsx` | Sidebar shadcn 240px/64px + topbar + `<Outlet />` |
| `src/features/coach/context/SelectedAthleteContext.tsx` | ID athlète sélectionné synchronisé avec URL |
| `src/features/coach/components/ContextBar.tsx` | Barre sticky athlète + tabs secondaires + combobox |
| `src/pages/coach/CoachAthleteArea.tsx` | `AthleteProvider` + `ContextBar` pour `/coach/athletes/:id/*` |
| `src/features/coach/pages/CoachHomePage.tsx` | Accueil coach `/coach` |
| `src/features/coach/pages/AthletesListPage.tsx` | Liste athlètes, invite, retrait `/coach/athletes` |
| `src/features/coach/pages/LibraryPage.tsx` | Banque exercices `/coach/library` |
| `src/features/coach/pages/CoachTestsBankPage.tsx` | Banque tests `/coach/tests` (placeholder) |
| `src/features/coach/pages/SettingsPage.tsx` | Paramètres coach `/coach/settings` |
| `src/features/coach/pages/PlanningPage.tsx` | Planning 4 vues (`?view=season\|block\|week\|day`) |

### Routing — avant / après

| Avant (PROMPT 1) | Après (PROMPT 2) |
|------------------|-----------------|
| `/coach` → CoachDashboard (sélection athlète) | `/coach` → CoachHomePage (dashboard coach) |
| `/coach/:athleteId/prog` → ProgPage | `/coach/athletes/:athleteId/planning` → PlanningPage |
| `/coach/:athleteId/banque` → BanquePage | `/coach/library` → LibraryPage (global) |
| `/coach/:athleteId/stats` → StatsPage | `/coach/athletes/:athleteId/stats` → StatsPage |
| `/coach/:athleteId/donnees` → DonneesPage | `/coach/athletes/:athleteId/donnees` → DonneesPage |
| `/coach/:athleteId/test` → TestPage | `/coach/athletes/:athleteId/tests` → TestPage |
| `/coach/:athleteId/retours` → RetoursPage | `/coach/athletes/:athleteId/retours` → RetoursPage |

### Anti-patterns résolus

| Avant | Après |
|-------|-------|
| `setActiveAthleteId` dans `useAuth` pour mémoriser l'athlète actif | URL = source de vérité (`/coach/athletes/:id`), sync via `SelectedAthleteContext` |
| Toute la nav coach dans un seul layout plat | `CoachShell` (sidebar globale) + `CoachAthleteArea` (sous-contexte athlète) |
| Banque exercices liée à un athlète (`/coach/:id/banque`) | Banque globale indépendante (`/coach/library`) |

### Fichiers obsolètes (gardés, plus utilisés dans les routes)

- `src/pages/coach/Dashboard.tsx` — ancien sélecteur d'athlète
- `src/pages/coach/CoachAthleteView.tsx` — remplacé par `CoachAthleteArea`

## À faire (prochaines étapes)

- Migrer les lectures Supabase restantes vers `useQuery` / `useMutation` (voir `AUDIT.md` §2)
- Extraire `<AthleteProfileCard>`, `<WellnessScoreChart>`, `<InjuryList>` (voir `AUDIT.md` §5)
- Supprimer `Dashboard.tsx` et `CoachAthleteView.tsx` après validation en TEST MANUEL
