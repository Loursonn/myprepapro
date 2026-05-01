# ENERGY_FEATURE.md — Module Séances Énergétiques

**Date :** 2026-05-01  
**Statut :** En production (PR#37-#44, feat/energy-refonte-planning)

---

## 1. Architecture

### Tables DB

| Table | Description |
|-------|-------------|
| `energy_sessions` | Banque partagée de séances (créée par coachs, vérifiées par coachs certifiés) |
| `energy_session_assignments` | Planification d'une séance pour un athlète à une date |

Tables supprimées lors de la refonte :
- `energy_session_config` (ancienne config par athlète)
- `energy_workout_logs` (anciens logs séances)
- `energy_exercises` (ancienne banque d'exercices cardio)

### energy_sessions

```sql
CREATE TABLE energy_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  session_kind      TEXT NOT NULL CHECK (session_kind IN ('vo2','tempo','seuil','footing','fartlek','autre','custom')),
  custom_kind       TEXT,
  structure_type    TEXT NOT NULL CHECK (structure_type IN ('continu','fractionne')),
  intervals         JSONB NOT NULL DEFAULT '[]',
  total_duration_s  INTEGER,
  total_distance_m  INTEGER,
  notes             TEXT,
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_verified       BOOLEAN NOT NULL DEFAULT false,
  verified_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### energy_session_assignments

```sql
CREATE TABLE energy_session_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  energy_session_id   UUID NOT NULL REFERENCES energy_sessions(id) ON DELETE CASCADE,
  scheduled_date      DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','missed','skipped')),
  microcycle_id       UUID REFERENCES microcycles(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 2. Format JSONB `intervals`

La colonne `intervals` stocke un `EnergyStep[]` — tableau d'intervalles et groupes répétés.

### Types TypeScript (src/types/energy.ts)

```typescript
// Durée d'un intervalle
type EnergyDuration =
  | { kind: 'time';       value: number }     // secondes
  | { kind: 'distance';   value: number }     // mètres
  | { kind: 'calories';   value: number }     // kcal
  | { kind: 'lap_button' }                    // fin manuelle

// Cible d'intensité (11 variantes)
type EnergyTarget =
  | { kind: 'none' }
  | { kind: 'hr_zone';         zone: 1|2|3|4|5 }
  | { kind: 'hr_pct';          min: number; max: number }
  | { kind: 'hr_bpm';          min: number; max: number }
  | { kind: 'pace';            min: number; max: number; unit: 'min_per_km'|'kmh' }
  | { kind: 'pace_test_pct';   test_metric: string; min: number; max: number }
  | { kind: 'power';           min: number; max: number }
  | { kind: 'power_test_pct';  test_metric: string; min: number; max: number }
  | { kind: 'cadence';         min: number; max: number; unit: 'spm'|'rpm' }
  | { kind: 'x_per_y';         x_kind: ...; y_kind: ...; x_value: number; y_value: number }
  | { kind: 'text';            value: string }

// Intervalle atomique
interface EnergyInterval {
  type: 'interval';
  id: string;       // UUID
  role: 'warmup'|'work'|'recovery'|'rest'|'cooldown'|'open';
  duration: EnergyDuration;
  target: EnergyTarget;
  notes?: string;
}

// Groupe répété (récursif)
interface EnergyGroup {
  type: 'group';
  id: string;
  role: string;
  repeat: number;           // ≥ 1
  children: EnergyStep[];   // EnergyInterval | EnergyGroup
  rest_between?: EnergyInterval; // repos entre répétitions (pas après la dernière)
}

type EnergyStep = EnergyInterval | EnergyGroup;
```

### Exemple JSONB : 2×5×400m@VMA + warmup/cooldown

```json
[
  {
    "type": "interval",
    "id": "wu-1",
    "role": "warmup",
    "duration": { "kind": "time", "value": 900 },
    "target": { "kind": "hr_zone", "zone": 2 },
    "notes": "Footing progressif"
  },
  {
    "type": "group",
    "id": "main-block",
    "role": "work",
    "repeat": 2,
    "children": [
      {
        "type": "group",
        "id": "reps",
        "role": "work",
        "repeat": 5,
        "children": [
          {
            "type": "interval",
            "id": "rep-400",
            "role": "work",
            "duration": { "kind": "distance", "value": 400 },
            "target": { "kind": "pace_test_pct", "test_metric": "VMA", "min": 95, "max": 100 }
          }
        ],
        "rest_between": {
          "type": "interval",
          "id": "recup-90",
          "role": "recovery",
          "duration": { "kind": "time", "value": 90 },
          "target": { "kind": "hr_zone", "zone": 1 }
        }
      }
    ],
    "rest_between": {
      "type": "interval",
      "id": "inter-serie",
      "role": "rest",
      "duration": { "kind": "time", "value": 300 },
      "target": { "kind": "none" }
    }
  },
  {
    "type": "interval",
    "id": "cd-1",
    "role": "cooldown",
    "duration": { "kind": "time", "value": 600 },
    "target": { "kind": "hr_zone", "zone": 1 }
  }
]
```

---

## 3. Helpers purs (src/lib/energy/index.ts)

| Fonction | Description |
|----------|-------------|
| `expandIntervals(root: EnergyGroup): FlatInterval[]` | Développe l'arbre en liste plate, répète chaque groupe selon `repeat`, insère `rest_between` entre répétitions |
| `estimateIntervalDuration(interval): number` | Estime la durée en secondes (time=direct, distance=pace ou 4m/s, calories=6s/kcal, lap_button=0) |
| `computeTotals(flat): { durationS, distanceM, workCount }` | Calcule les totaux de la séance |
| `targetToIntensityPct(target): number \| null` | Convertit une cible en % d'intensité (0-100) |
| `intensityToColor(pct): string` | Gradient HSL vert→rouge |
| `computeZoneDistribution(flat): ZoneDistribution` | Répartition Z1-Z5 + uncategorized en secondes |

### src/lib/energy/formatTarget.ts

| Fonction | Description |
|----------|-------------|
| `formatTarget(target): string` | "Z3", "150-160 bpm", "85-95% VMA", "5'00-5'15/km" |
| `formatS(secs): string` | "MM:SS" |
| `formatSLong(secs): string` | "HH:MM:SS" |

### src/lib/energy/treeUtils.ts

Utilitaires de mutation de l'arbre EnergyGroup (tous purs) :
- `genId()` — `crypto.randomUUID()`
- `findParent(root, id)`, `findStep(root, id)`
- `updateStep(root, updated)`, `deleteStep(root, id)`, `duplicateStep(root, id)`
- `reorderChildren(root, parentId, fromIdx, toIdx)` — même parent uniquement
- `addStepToGroup(root, parentId, step)`
- `makeInterval()`, `makeGroup()`, `makeRootGroup()` — factories avec defaults

---

## 4. RLS

### energy_sessions
| Opération | Condition |
|-----------|-----------|
| SELECT | Tout utilisateur authentifié |
| INSERT | Coach/coach_athlete ; `is_verified` forcé false |
| UPDATE | Auteur (séance non vérifiée) OU coach certifié/admin (peut set `is_verified=true`) |
| DELETE | Auteur (non vérifiée) OU admin |

### energy_session_assignments
| Opération | Condition |
|-----------|-----------|
| SELECT | `athlete_id = auth.uid()` OU `is_coach_of(athlete_id)` OU admin |
| INSERT | `is_coach_of(athlete_id)` OU admin |
| UPDATE | `is_coach_of(athlete_id)` OU admin |
| DELETE | `is_coach_of(athlete_id)` OU admin |

---

## 5. Hooks React Query (src/features/shared/hooks/)

### useEnergySessions.ts
- `useEnergySessions(filters?)` — liste banque
- `useEnergySession(id)` — session individuelle
- `useCreateEnergySession()` — calcule totaux avant insert
- `useUpdateEnergySession()` — calcule totaux si intervals changent
- `useDeleteEnergySession()`
- `useVerifyEnergySession()` — bascule is_verified + verified_at

### useEnergyAssignments.ts
- `useEnergyAssignments(athleteId, dateRange?)` — avec jointure energy_sessions(*)
- `useAssignEnergySession()` — crée une assignation
- `useUpdateEnergyAssignment()` — met à jour (date, statut, notes)
- `useUnassignEnergySession()` — supprime

Toutes les mutations ont : optimistic update → rollback → toast sonner.

---

## 6. Composants (src/features/coach/components/energy/)

| Composant | Description |
|-----------|-------------|
| `SessionPreview` | Graphe SVG variable-width + zone bar + totaux. Props: `{ intervals: EnergyGroup, compact? }` |
| `HatchPattern` | SVG `<pattern>` hachuré pour intensité inconnue |
| `IntervalEditor` | Sheet shadcn — édition d'un EnergyInterval (rôle, durée, cible 10 variantes) |
| `IntervalBuilder` | Liste DnD (@dnd-kit/sortable) des intervalles/groupes, récursif |
| `EnergySessionCard` | Card banque : preview compact + badge kind/vérifié + actions |
| `EnergyAssignmentDrawer` | Sheet — détails assignation : preview, date, statut, reschedule/duplicate/delete |
| `EnergyCalendarView` | Calendrier mensuel DnD des assignations |
| `SessionPickerDialog` | Dialog choix séance pour assignation rapide (click sur date) |

---

## 7. Routes

| Route | Composant | Description |
|-------|-----------|-------------|
| `/coach/energy-library` | `EnergyLibraryPage` | Banque partagée (grid + filtres) |
| `/coach/energy-library/new` | `EnergySessionEditorPage` | Création séance (sans athlète) |
| `/coach/energy-library/:id/edit` | `EnergySessionEditorPage` | Édition séance |
| `/coach/athletes/:id/energy/new` | `EnergySessionEditorPage` | Création séance (pour athlète) |
| `/coach/athletes/:id/energy/:sid/edit` | `EnergySessionEditorPage` | Édition séance (pour athlète) |
| `/coach/athletes/:id/planning?view=month` | `CalendarMonthView` unifié | Calendrier muscu + énergie sur une seule vue |
| `/coach/athletes/:id/programmation` → onglet Énergétique | `EnergyAssignmentList` | Liste séances assignées à l'athlète |

---

## 8. Flow utilisateur

### Création et publication dans la banque
1. Coach va sur **⚡ Énergie** dans la sidebar
2. Clic **+ Nouvelle séance**
3. Saisit nom, type (VO2/Tempo/Seuil/…), structure (Continu/Fractionné)
4. Ajoute des intervalles via **+ Intervalle** (ou **+ Groupe répété** pour du fractionné)
5. Pour chaque intervalle : rôle, durée, cible d'intensité
6. Aperçu temps réel dans le panneau de droite (graphe SVG + zone bar + totaux)
7. Clic **Enregistrer** → séance en banque (`is_verified=false`)

### Vérification (coach certifié)
1. Coach certifié ouvre la séance depuis la banque
2. Clic **Vérifier** → `is_verified=true`, badge vert "✓ Vérifiée"

### Planification pour un athlète
#### Depuis l'éditeur
1. Route `/coach/athletes/:id/energy/new`
2. Clic **Enregistrer & planifier** → modal date picker → assignation créée

#### Depuis le calendrier planning
1. Coach ouvre Planning → onglet **Énergétique**
2. Clic sur une date vide → **SessionPickerDialog** → choisit la séance → assignation créée
3. Drag & drop d'un event vers une autre date → date mise à jour

### Consultation
1. Clic sur un event du calendrier → **EnergyAssignmentDrawer**
2. Voir preview compact + statut + actions (reschedule, dupliquer, supprimer)

---

## 9. Règles métier importantes

- `total_duration_s` et `total_distance_m` sont **toujours recalculés** avant insert/update via `computeTotals(expandIntervals(root))`
- `is_verified` ne peut être mis à `true` que par un coach certifié ou admin (RLS + trigger)
- Le drag & drop inter-parent n'est **pas supporté** dans l'éditeur (même parent uniquement)
- `rest_between` est inséré entre chaque répétition d'un groupe, **pas après la dernière**
- Les `lap_button` ont une durée estimée de 0 et ne contribuent pas aux totaux
