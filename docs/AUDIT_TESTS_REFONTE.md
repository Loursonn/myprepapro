# AUDIT_TESTS_REFONTE.md
**Date :** 2026-04-30  
**Scope :** Tests énergétiques + statut coach certifié

---

## 1. Modèle de données actuel — tests énergétiques

### 1.1 Tables directement liées

#### `test_sessions` (migration `20260419_energy_test_performance.sql`)
| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK | |
| athlete_id | uuid FK → profiles | |
| coach_id | uuid FK → profiles | SET NULL |
| type | text | `musculation` \| `energetique` \| `specifique` \| `mobilite` \| `custom` |
| custom_type | text | nullable |
| title | text | saisie libre |
| description | text | nullable |
| reference_file_url | text | base64 (images) ou signed URL (PDF) |
| reference_file_type | text | `image` \| `pdf` |
| date | date | |
| completed | boolean | |
| results_structured | jsonb | `{ metrics: [{ name, value, unit }][] }` — libre, non contraint |
| results_note | text | |
| created_at / updated_at | timestamptz | |

**Problème majeur :** `results_structured` est un JSONB libre. Les clés des métriques (`name`) sont des chaînes saisies librement par l'utilisateur (ex : "VMA", "vma", "Vitesse Max Aérobie"). Impossible de les consommer de façon fiable par un système de programmation.

#### `performance_logs` (même migration)
| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK | |
| athlete_id | uuid FK → profiles | |
| metric_type | text | deviné par `guessMetricType()` côté client — heuristique non fiable |
| metric_name | text | chaîne libre |
| value | numeric | |
| unit | text | |
| custom_unit | text | |
| date | date | |
| test_session_id | uuid FK → test_sessions | nullable, SET NULL |
| is_active_reference | boolean | index unique partiel : un seul actif par (athlete_id, metric_name) |
| coach_validated | boolean | |
| notes | text | |
| created_by | uuid FK → profiles | |
| created_at | timestamptz | |

**Problème :** `is_active_reference` est géré manuellement via la function `set_active_performance_reference()`. La "valeur courante" = la référence active choisie manuellement, pas nécessairement le max. Il n'y a pas de vue automatisée "meilleure valeur".

#### `performance_notifications`
| Colonne | Type |
|---|---|
| id | uuid PK |
| coach_id | uuid FK → profiles |
| athlete_id | uuid FK → profiles |
| performance_log_id | uuid FK → performance_logs |
| status | text DEFAULT 'pending' |
| created_at / resolved_at | timestamptz |

#### `energy_exercises` (banque d'exercices énergétiques)
Catalogue partagé d'exercices cardio (VMA, fractionné, etc.). Distinct du catalogue de tests — ce sont des exercices de séances, pas des protocoles de test.

#### `energy_session_config` + `energy_workout_logs`
Séances énergétiques planifiées et réalisées. **Pas directement lié aux tests** — c'est le suivi quotidien des séances cardio, pas les évaluations.

### 1.2 RLS actuelle sur test_sessions

```sql
SELECT : athlete_id = auth.uid() OR coach_id = auth.uid() OR is_admin
INSERT : athlete_id = auth.uid() OR coach_id = auth.uid() OR is_admin
UPDATE : athlete_id = auth.uid() OR coach_id = auth.uid() OR is_admin
DELETE : athlete_id = auth.uid() OR coach_id = auth.uid() OR is_admin
```

**Gap :** Un coach peut voir les `test_sessions` d'un athlète uniquement si `coach_id = auth.uid()`, mais cette colonne est remplie dans le code par `isCoach ? athleteId : null` (bug — elle devrait stocker l'ID du coach, pas de l'athlète). La vraie relation coach→athlète via `profiles.coach_id` n'est pas utilisée pour ce SELECT.

### 1.3 RLS actuelle sur performance_logs

```sql
SELECT : athlete_id = auth.uid() OR is_coach_of(athlete_id) OR is_admin
INSERT/UPDATE/DELETE : idem
```
Correcte (utilise `is_coach_of`).

---

## 2. Composants / hooks / pages qui touchent aux tests

### 2.1 Composant principal
**`src/components/TestSessionView.tsx`** (~650 lignes)
- Monolithe sans React Query
- Fetches directs via `supabase.from().select()` dans `useEffect` et fonctions async
- Pas de skeleton — affiche `"Chargement…"` en texte
- Pas d'optimistic updates — `setSaving(true)` + re-fetch complet
- Inline styles (pas Tailwind/shadcn)
- `guessMetricType(name)` — heuristique sur le label texte pour deviner le type de métrique
- Gère création, édition, remplissage des résultats, et enregistrement dans `performance_logs`

### 2.2 Pages
| Fichier | Route | Notes |
|---|---|---|
| `src/features/coach/pages/TestPage.tsx` | `/coach/athletes/:id/tests` | Wrapper mince → TestSessionView (isCoach=true) |
| `src/features/athlete/pages/AthleteTestPage.tsx` | `/athlete/tests` | Wrapper mince → TestSessionView (isCoach=false) |
| `src/features/coach/pages/CoachTestsBankPage.tsx` | `/coach/tests` | **Placeholder vide** — marqué "Implémenté en PROMPT 3" |

### 2.3 Hooks existants liés
- **`useEnergySessions`** — lit `energy_session_config` + `app_data` pour les séances énergétiques. Non lié aux `test_sessions`.
- **Aucun hook React Query** n'existe pour `test_sessions` ou `performance_logs`.

### 2.4 Planning — `TestMarkers.tsx`
`src/features/coach/components/planning/TestMarkers.tsx` — affiche des marqueurs de tests sur la timeline. Lit probablement `test_sessions`. Point d'impact à vérifier lors de la migration.

---

## 3. Modèle actuel des comptes coach

### Table `profiles` — colonnes pertinentes
| Colonne | Type | Ajoutée par |
|---|---|---|
| role | text | migration initiale |
| coach_code | text UNIQUE | `20260329112516_add_coach_code_to_profiles.sql` |
| is_admin | boolean NOT NULL DEFAULT false | `20260410_exercises_rls.sql` |
| **is_certified_coach** | — | **N'existe pas encore** |

### Rôles possibles
- `coach` — coach pur
- `athlete` — athlète pur  
- `coach_athlete` — les deux (ex : Hugo ou Titouan qui s'entraînent eux-mêmes)

### Gestion actuelle du rôle
- Défini à l'inscription (onboarding)
- `is_admin` gérable uniquement en SQL direct (pas d'UI)
- Pas de notion de coach "certifié" dans la BDD

### Coachs à certifier (seed idempotent)
| Nom | coach_code | Statut cible |
|---|---|---|
| Hugo TANGUY | `R4BL7M` | `is_admin = true`, `is_certified_coach = true` |
| Titouan MAUMEGE | `E7CJRR` | `is_admin = true`, `is_certified_coach = true` |

---

## 4. Points d'impact + plan de migration sans casser l'existant

### 4.1 Ce qui est cassé / insuffisant aujourd'hui

| Problème | Impact |
|---|---|
| `results_structured` JSONB libre | Impossible de consommer VMA/VC par le système de programmation |
| `guessMetricType()` heuristique | Métrique mal catégorisée si le titre ne contient pas exactement "vma" |
| Pas de catalogue de tests | Chaque coach réinvente les mêmes tests (Cooper, Yo-Yo, etc.) |
| `is_active_reference` manuel | La "valeur courante" n'est pas automatiquement le max, gestion fragmentée |
| `TestSessionView` sans React Query | Pas de cache, pas d'optimistic updates, pas de skeletons |
| `CoachTestsBankPage` vide | Placeholder non implémenté |
| `performance_notifications.test_session_id` | Colonne FK qui n'existe pas dans la table (bug dans le code — INSERT utilise `test_session_id` mais la table a `performance_log_id`) |

### 4.2 Stratégie de migration — coexistence

**Principe :** les nouvelles tables (`test_definitions`, `test_variables`, `athlete_test_results`, `athlete_test_values`) coexistent avec `test_sessions` et `performance_logs` existants. On ne supprime rien dans cette migration.

**Data migration :** Pour chaque `test_sessions` existant avec `results_structured.metrics` non vide :
- Créer un `test_definitions` avec `kind = 'custom'`, `created_by = coach_id || athlete_id`
- Pour chaque metric → créer `test_variables` avec `key = slugify(metric.name)`, `label = metric.name`, `unit = metric.unit`, `value_type = 'number'`, `better_when = 'higher'`
- Créer `athlete_test_results` + `athlete_test_values`

Cette migration de données est **optionnelle au déploiement initial** (les données historiques restent accessibles via l'ancienne UI si on la laisse en place), mais documenter la procédure.

**Plan de dépréciation :**
1. Phase 1 : nouvelles tables + nouvelle UI → les deux coexistent
2. Phase 2 (future) : migration des données historiques + suppression `TestSessionView` et ancienne UI
3. Phase 3 (future) : suppression `test_sessions` / `performance_logs` si plus utilisés

### 4.3 Pages/composants à créer

| Fichier | Description |
|---|---|
| `src/features/coach/pages/CoachTestsBankPage.tsx` | Remplace placeholder — catalogue presets + custom coach |
| `src/features/coach/pages/AthleteTestsTab.tsx` | Onglet Tests dans fiche athlète (remplace TestPage → TestSessionView) |
| `src/features/athlete/pages/AthleteTestPage.tsx` | Refonte — lecture seule résultats + valeurs courantes |
| `src/features/coach/components/tests/TestDefinitionDrawer.tsx` | Création/édition d'un test custom |
| `src/features/coach/components/tests/TestResultDrawer.tsx` | Ajout résultats athlète |
| `src/features/coach/pages/CoachesListPage.tsx` | Phase 2 — liste coachs certifiés |
| `src/features/shared/hooks/tests/useTestDefinitions.ts` | React Query — catalogue |
| `src/features/shared/hooks/tests/useAthleteTestResults.ts` | React Query — résultats athlète |
| `src/features/shared/hooks/tests/useAthleteCurrentValues.ts` | React Query — valeurs courantes (PR par variable) |
| `src/features/shared/hooks/tests/useCreateTestDefinition.ts` | Mutation — création test custom |
| `src/features/shared/hooks/tests/useUpsertTestResult.ts` | Mutation — ajout/édition résultat |

### 4.4 Migrations Supabase à créer

| Fichier | Contenu |
|---|---|
| `20260430100000_test_definitions.sql` | Nouvelles tables + vue `athlete_current_values` + RLS + seed presets |
| `20260430200000_certified_coach.sql` | Colonne `is_certified_coach` + RLS + seed Hugo/Titouan |

---

## 5. Presets proposés — validation requise

Liste proposée pour le seed initial :

| Key | Label | Unit | value_type | better_when | Notes |
|---|---|---|---|---|---|
| `vma` | VMA | km/h | number | higher | Vitesse Maximale Aérobie |
| `vc` | Vitesse Critique | km/h | number | higher | ~CV, seuil de durabilité |
| `fe` | Facteur d'Endurance | % | number | higher | VC/VMA × 100 — calculé, mais peut être mesuré directement |
| `vo2max` | VO2max | mL/kg/min | number | higher | |
| `fc_max` | FCmax | bpm | number | higher | Sémantique : higher = le plafond est atteint, c'est bien. À documenter. |
| `seuil_lactate` | Seuil Anaérobie | km/h | number | higher | Vitesse au seuil 4mmol |
| `cooper` | Test Cooper (12min) | m | number | higher | Distance en 12 minutes |
| `demi_cooper` | Demi-Cooper (6min) | m | number | higher | |

**Questions pour validation :**
1. Faut-il inclure Cooper/demi-Cooper ou les garder comme tests custom ?
2. `fc_max` : `better_when = 'higher'` est correct (c'est un plafond physiologique qu'on cherche à mesurer précisément) — confirmation ?
3. `fe` peut être calculé automatiquement si VMA et VC sont connues — future feature, pas Phase 1, OK ?
4. Voulez-vous des tests de force (1RM squat, 1RM bench) dans les presets ? Le modèle le supporte, mais c'est une logique différente (par exercice, pas par protocole). Je suggère de les laisser en `custom` pour l'instant.

---

## 6. Questions bloquantes avant Phase 1

1. **`better_when` sur `fc_max`** : higher ou lower ? (FCmax = 185 bpm est "mieux" qu'une mauvaise mesure à 170 bpm, mais la sémantique est ambiguë)
2. **Données historiques** : la migration de `test_sessions` → nouveau modèle est-elle requise en Phase 1, ou peut-on la reporter ?
3. **`TestSessionView.tsx`** : je propose de le laisser en place (routes inchangées) pendant la Phase 1 et de le remplacer progressivement. Confirmer ?
4. **`performance_notifications`** : garder ou déprécier ? Le bug `test_session_id` vs `performance_log_id` est présent mais la feature est peu utilisée.

---

**Audit terminé. En attente de validation avant Phase 1.**
