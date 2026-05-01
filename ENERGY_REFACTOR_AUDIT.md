# ENERGY_REFACTOR_AUDIT.md

> Audit du module énergétique avant refonte complète.
> Date : 2026-04-30 — branche `dev`
> **Aucune modification effectuée dans ce document.**

---

## 1. Existant DB

### 1.1 Table `energy_exercises`

**Migration :** `supabase/migrations/20260419_energy_test_performance.sql`

| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| name | TEXT | NOT NULL |
| type | TEXT | NOT NULL — valeurs : course, skierg, bikeerg, wattbike, rameur, velo, natation, corde, custom |
| custom_type | TEXT | NULL |
| description | TEXT | NULL |
| photo_url | TEXT | NULL — bucket `energy-exercise-photos` |
| is_official | BOOLEAN | DEFAULT false |
| created_by | UUID | FK → profiles(id) ON DELETE SET NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

**RLS :**
- `energy_ex_select` — SELECT : public (true)
- `energy_ex_insert` — INSERT : `created_by = auth.uid() OR is_admin`
- `energy_ex_update` — UPDATE : idem
- `energy_ex_delete` — DELETE : idem

**Aucun trigger ni fonction associée.**

---

### 1.2 Table `energy_session_config`

| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| athlete_id | UUID | FK → profiles(id) ON DELETE CASCADE NOT NULL |
| session_key | TEXT | NOT NULL |
| session_label | TEXT | NULL |
| appareil_types | TEXT[] | NOT NULL DEFAULT '{}' |
| custom_appareils | TEXT[] | NULL DEFAULT '{}' |
| modalite | TEXT | NOT NULL DEFAULT 'intermittent' |
| custom_modalite | TEXT | NULL |
| blocks | JSONB | NOT NULL DEFAULT '[]' — voir types EnergyBlock |
| photo_url | TEXT | NULL |
| energy_exercise_id | UUID | FK → energy_exercises(id) ON DELETE SET NULL — non utilisé en pratique |
| note_coach | TEXT | NULL |
| created_by | UUID | FK → profiles(id) ON DELETE SET NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |
| UNIQUE(athlete_id, session_key) | | |

**RLS :**
- `energy_cfg_select` — SELECT : `athlete_id = auth.uid() OR role IN ('coach','coach_athlete') OR is_admin`
  - ⚠️ PROBLÈME (noté DB_AUDIT.md) : un coach voit les configs de tous les athlètes, pas seulement les siens
- `energy_cfg_insert/update/delete` — `role IN ('coach','coach_athlete') OR is_admin`
  - ⚠️ PROBLÈME : un coach peut modifier les sessions d'un athlète qui ne lui appartient pas

**Aucun trigger ni fonction associée.**

---

### 1.3 Table `energy_workout_logs`

| Colonne | Type | Contraintes |
|---|---|---|
| id | UUID | PK |
| athlete_id | UUID | FK → profiles(id) ON DELETE CASCADE NOT NULL |
| session_key | TEXT | NOT NULL — lien logique vers energy_session_config.session_key |
| session_label | TEXT | NULL — cache du label |
| date | DATE | NOT NULL DEFAULT CURRENT_DATE |
| completed | BOOLEAN | DEFAULT false |
| respected | BOOLEAN | NULL — true = 100%, false = allégé/adapté |
| duration_min | INTEGER | NULL |
| distance_m | INTEGER | NULL |
| meteo | TEXT[] | DEFAULT '{}' |
| lieu | TEXT | NULL |
| lieu_custom | TEXT | NULL |
| note | TEXT | NULL |
| garmin_url | TEXT | NULL — URL signée (90 jours) |
| garmin_expires_at | TIMESTAMPTZ | NULL |
| interval_logs | JSONB | DEFAULT '[]' — réservé, non utilisé |
| created_at | TIMESTAMPTZ | DEFAULT now() |

**RLS :**
- `energy_log_select` — `athlete_id = auth.uid() OR role IN ('coach','coach_athlete') OR is_admin`
  - ⚠️ même problème cross-coach que energy_session_config
- `energy_log_insert/update/delete` — `athlete_id = auth.uid()`

**Aucun trigger ni fonction associée.**

---

### 1.4 Tables connexes (scope partiel du module énergétique)

Ces tables sont dans la même migration (`20260419_energy_test_performance.sql`) mais sont remplacées par le nouveau système de tests (migration `20260430100000_test_definitions.sql`) :

**`test_sessions`** — remplacée par `athlete_test_results` + `athlete_test_values`
**`performance_logs`** — remplacée par `athlete_current_values` (vue)
**`performance_notifications`** — liée à `performance_logs`, orpheline après refonte tests

---

### 1.5 Buckets Storage

| Bucket | Public | Taille max | MIME autorisés |
|---|---|---|---|
| `garmin-screenshots` | Non | 10 MB | image/jpeg, png, webp, heic |
| `test-files` | Non | 20 MB | image/jpeg, png, webp, application/pdf |
| `energy-exercise-photos` | **Oui** | 5 MB | image/jpeg, png, webp |

**`garmin-screenshots` et `test-files`** : à DROP si les tables associées disparaissent.
**`energy-exercise-photos`** : à conserver si la banque d'exercices subsiste sous une autre forme.

---

### 1.6 Stockage du planning énergétique (app_data)

Le plan hebdo/journalier est stocké dans la table `app_data` (JSONB clé-valeur) :
- `key = 'asp:energy_week_plan'` → `Record<semaine, session_key[]>`
- `key = 'asp:energy_day_plan'` → `Record<semaine, { session_key: day_of_week }>`

**⚠️ Pas une vraie relation DB.** Aucune FK, aucune contrainte d'intégrité. Si une session est supprimée, son ID reste dans `app_data`.

---

## 2. Existant code

### 2.1 Composants

| Fichier | Rôle | Dépendances |
|---|---|---|
| `src/components/coach/EnergySessionEditor.tsx` | Éditeur modal de séance (blocs + intervalles + intensité) | Supabase direct, bucket `energy-exercise-photos` |
| `src/components/coach/EnergyExerciseBank.tsx` | CRUD banque d'exercices énergétiques | Supabase direct, bucket `energy-exercise-photos` |
| `src/components/coach/CoachComponents.jsx` | Export `CoachEnergyProgram` (JSX minifié, ~140 lignes) | EnergySessionEditor, Supabase direct, app_data |
| `src/components/athlete/EnergySessionLog.tsx` | Vue athlète 3 étapes : liste → prescription → log | EnergySessionEditor (types), Supabase direct, bucket `garmin-screenshots` |

**Types exportés depuis `EnergySessionEditor.tsx` (utilisés aussi par `EnergySessionLog.tsx`) :**
```typescript
IntensityUnit   = "pct_vma" | "pct_fc" | "pct_vc" | "kmh" | "min_km" | "watts" | "libre"
RecoveryType    = "actif" | "passif"
ModaliteType    = "continu" | "intermittent" | "fartleck" | "tabata" | "tempo" | "custom"
IntensityTarget = { type: IntensityUnit; value: number; value_max?: number }
EnergyInterval  = { id, reps, effort: { distance_m?, duration_s?, intensity }, recovery: { type, duration_s, intensity? } }
EnergyBlock     = { id, name, sets?, modalite, custom_modalite?, intervals }
EnergyConfig    = { id?, session_key, session_label?, appareil_types, custom_appareils, blocks, photo_url?, note_coach? }
```

---

### 2.2 Hooks

| Fichier | Rôle |
|---|---|
| `src/features/shared/hooks/useEnergySessions.ts` | Charge les sessions + plans (week/day) depuis `energy_session_config` + `app_data`. Expose état local + mutations save. Utilisé par `AthleteContext`. |

**Problème architectural :** le hook mélange React Query (`useQuery`) et `useState` local pour l'état optimiste. Les plans (week/day) transitent par `app_data` au lieu d'une table dédiée.

---

### 2.3 Context

`src/features/shared/context/AthleteContext.tsx` expose via `useAthleteContext()` :
```typescript
energySessions: EnergySession[]
setEnergySessions: (v) => void
energySessionsLoaded: boolean
setEnergySessionsLoaded: (v) => void
energyWeekPlan: Record<string, unknown>
setEnergyWeekPlan: (v) => void      // déclenche UPSERT app_data
energyDayPlan: Record<string, unknown>
setEnergyDayPlan: (v) => void       // déclenche UPSERT app_data
energyEditorKey: string | null
setEnergyEditorKey: (v) => void
```

---

### 2.4 Types partagés

`src/features/shared/types/athlete.ts` :
```typescript
export interface EnergySession {
  id: string;
  session_key: string;
  session_label: string;
  appareil_types: string[];
  athlete_id?: string;
}

// VisibilitySettings.energy: boolean — toggle module dans profil athlète
```

`src/lib/queryKeys.ts` :
```typescript
QK.energySessions(aid)  // ['energySessions', aid]
QK.energyPlan(aid)      // ['energyPlan', aid]
```

---

### 2.5 Pages et routes

**Routes :**
```
/athlete/log           → LogSeancePage   (legacy — App.tsx ligne 96)
/coach/athletes/:id/programmation → ProgrammationPage (onglet Énergie)
/coach/library         → LibraryPage (onglet banque énergie)
```

Pas de route dédiée `/energy` — le module est toujours un sous-onglet.

**Consommateurs :**

| Fichier | Usage |
|---|---|
| `src/features/coach/pages/ProgrammationPage.tsx` | Onglet "Énergie" → `<CoachEnergyProgram>` avec tout l'état du context |
| `src/features/coach/pages/ProgPage.tsx` | Même chose — doublon legacy (`ProgPage` vs `ProgrammationPage`) |
| `src/features/coach/pages/LibraryPage.tsx` | Onglet "Énergie" → `<EnergyExerciseBank>` |
| `src/features/coach/pages/BanquePage.tsx` | Onglet "energie" → `<EnergyExerciseBank>` — doublon legacy |
| `src/features/athlete/pages/LogSeancePage.tsx` | Route legacy `/athlete/log` → `<EnergySessionLog>` |
| `src/features/athlete/pages/DashboardPage.tsx` | Reçoit energySessions/WeekPlan/DayPlan du context (affiché dans le dashboard) |
| `src/features/shared/hooks/useAthletePersistedState.ts` | Charge `test_sessions` (ancien système), initialise `visibilitySettings.energy = true` |

**Références aux anciennes tables `test_sessions` / `performance_logs` (orphelines depuis refonte tests) :**
- `useAthletePersistedState.ts` ligne 91 : `supabase.from('test_sessions').select(...)`
- `useTimelineData.ts` ligne 82 : `supabase.from("test_sessions")...`
- `useUnifiedCalendar.ts` lignes 81, 238, 271 : insère et lit dans `test_sessions`
- `useCalendarEvents.ts` lignes 43, 162, 187 : idem
- `src/features/coach/components/planning/hooks/useTimelineData.ts` ligne 66 : idem

---

## 3. Plan de suppression / migration

### 3.1 À supprimer en DB (DROP)

| Objet | Raison |
|---|---|
| `energy_session_config` | Remplacé par un nouveau schéma (sessions typées, FK planning) |
| `energy_workout_logs` | Remplacé par un nouveau log enrichi |
| `energy_exercises` | À remplacer (ou renommer/migrer) — banque à refondre |
| `test_sessions` | Remplacé par `athlete_test_results` (migration 20260430100000) |
| `performance_logs` | Remplacé par `athlete_current_values` (vue) + `athlete_test_values` |
| `performance_notifications` | Orpheline — dépend de `performance_logs` |
| Bucket `garmin-screenshots` | Si le nouveau log ne reprend pas l'upload Garmin |
| Bucket `test-files` | Orphelin après suppression de `test_sessions` |
| Clés `app_data` `asp:energy_week_plan` + `asp:energy_day_plan` | Remplacées par vraies FK en DB |

**À conserver :**
- Bucket `energy-exercise-photos` — si la banque d'exercices est maintenue sous forme similaire

---

### 3.2 Fichiers TS/TSX à supprimer

| Fichier | Raison |
|---|---|
| `src/components/coach/EnergySessionEditor.tsx` | Remplacé par nouveau composant |
| `src/components/coach/EnergyExerciseBank.tsx` | Remplacé par nouveau composant |
| `src/components/athlete/EnergySessionLog.tsx` | Remplacé par nouveau composant |
| `src/features/shared/hooks/useEnergySessions.ts` | Remplacé par nouveaux hooks React Query |
| `src/features/athlete/pages/LogSeancePage.tsx` | Route legacy — à rediriger ou supprimer |
| `src/features/coach/pages/ProgPage.tsx` | Doublon de ProgrammationPage |
| `src/features/coach/pages/BanquePage.tsx` | Doublon de LibraryPage |

**Export `CoachEnergyProgram` dans `src/components/coach/CoachComponents.jsx`** — à retirer du fichier JSX (mais le fichier contient d'autres exports utilisés — ne pas supprimer entièrement).

---

### 3.3 Références orphelines à nettoyer

| Fichier | Ligne(s) | Nettoyage |
|---|---|---|
| `src/features/shared/hooks/useAthletePersistedState.ts` | 44, 91, 188 | Retirer `testSessions` + requête `test_sessions` |
| `src/features/shared/hooks/useTimelineData.ts` | 82 | Pointer vers `athlete_test_results` |
| `src/features/shared/hooks/useUnifiedCalendar.ts` | 81, 238, 271 | Idem |
| `src/features/shared/hooks/useCalendarEvents.ts` | 43, 162, 187 | Idem |
| `src/features/coach/components/planning/hooks/useTimelineData.ts` | 66 | Idem |
| `src/features/shared/context/AthleteContext.tsx` | 55–59, 195, 209 | Retirer les champs energy* du context |
| `src/features/shared/types/athlete.ts` | 122–130, 149 | Retirer `EnergySession`, `VisibilitySettings.energy` |
| `src/lib/queryKeys.ts` | 9–10 | Retirer `energySessions`, `energyPlan` |
| `src/App.tsx` | 27, 96 | Route `/athlete/log` → supprimer ou rediriger |
| `src/features/athlete/pages/DashboardPage.tsx` | 14–15, 105–106 | Retirer props energy* |

---

### 3.4 Données en production — migrer ou perdre ?

| Table | Volume estimé | Décision conseillée |
|---|---|---|
| `energy_session_config` | Faible (projet en dev, 2 coachs) | **Perdre** — les configs JSONB (blocks) ne mappent pas directement sur un nouveau schéma normalisé. Recréer manuellement. |
| `energy_workout_logs` | Faible | **Perdre** — historique minimal, pas critique |
| `energy_exercises` | Faible (banque manuelle) | **Migrer** si le nouveau schéma garde la même structure name/type ; sinon **perdre et recréer** |
| `test_sessions` | Quelques enregistrements | **Déjà migré** via `20260430100000_test_definitions.sql` (bloc PL/pgSQL idempotent) |
| `performance_logs` | Quelques enregistrements | **Déjà migré** vers `athlete_test_values` |
| `app_data` clés energy | Quelques lignes | **Perdre** — logique remplacée |

**Verdict global :** projet en phase de développement, usage réel minimal. Pas de migration nécessaire. DROP + reconstruction propre.

---

## 4. Risques identifiés

### 4.1 Hooks planning qui lisent `test_sessions`
`useUnifiedCalendar.ts`, `useCalendarEvents.ts`, `useTimelineData.ts` insèrent et lisent encore dans `test_sessions`. Si on DROP la table avant de mettre à jour ces hooks, le calendrier plante. **Ordre impératif : mettre à jour les hooks avant de DROP.**

### 4.2 RLS cross-coach (existant, non corrigé)
Les politiques `energy_cfg_select` et `energy_log_select` permettent à n'importe quel coach de voir les données de tous les athlètes. La refonte doit introduire la même politique `is_coach_of()` que pour les tests (`20260430100000_test_definitions.sql`).

### 4.3 Types Supabase générés
`src/integrations/supabase/types.ts` contient les types de toutes les tables energy + performance_logs + test_sessions. Après DROP des tables, `supabase gen types typescript --linked` les retirera automatiquement. Tous les imports de ces types dans les composants/hooks seront cassés — à traiter avant ou après selon la stratégie de migration.

### 4.4 `CoachComponents.jsx` monolithique
`CoachEnergyProgram` est exporté depuis un fichier JSX non typé (~2500 lignes). Supprimer l'export sans casser les autres exports (`CoachConfig`, `TierConfigModal`, `CoachWeeklyFeedback`, etc.) nécessite une chirurgie précise. Le fichier n'est pas TypeScript — risque d'erreurs silencieuses.

### 4.5 `EnergySessionLog` importe des types depuis `EnergySessionEditor`
```typescript
// EnergySessionLog.tsx ligne 3
import type { EnergyConfig, EnergyBlock, IntensityTarget, IntensityUnit }
  from "@/components/coach/EnergySessionEditor";
```
Si `EnergySessionEditor.tsx` est supprimé avant que `EnergySessionLog.tsx` soit remplacé, le build casse. Les types doivent être déplacés vers `src/features/shared/types/` avant toute suppression.

### 4.6 Planning stocké dans `app_data` (JSONB sans FK)
Les clés `asp:energy_week_plan` et `asp:energy_day_plan` contiennent des `session_key` sous forme de chaînes libres. Aucune contrainte d'intégrité — des references orphelines existent probablement déjà. La refonte doit introduire une vraie table de liaison.

### 4.7 `ProgPage.tsx` + `BanquePage.tsx` (doublons)
Ces fichiers legacy importent les composants énergie. Ils semblent non utilisés (pas de routes dans `App.tsx`), mais une recherche confirmatoire est nécessaire avant suppression.

### 4.8 Bucket `garmin-screenshots` — URLs signées
Les logs existants stockent des `garmin_url` signées (90 jours). Si le bucket est supprimé, les URLs sont invalides. Pas critique (données de dev), mais à documenter.

---

## Résumé exécutif

Le module énergétique est **fonctionnel mais architecturalement fragile** :
- 3 tables DB avec RLS insuffisante (cross-coach)
- Planning stocké en JSONB dans `app_data` (sans FK)
- Composants non TypeScript (`CoachComponents.jsx`)
- Types exportés depuis un composant (couplage fort)
- 5 hooks planification qui lisent encore `test_sessions` (table remplacée)
- 2 pages doublons (`ProgPage`, `BanquePage`)

**Recommandation :** refonte complète. Données prod négligeables → DROP sans migration. Seul risque : ordre de suppression des fichiers vs tables.

---

*Attente de validation avant toute modification.*
