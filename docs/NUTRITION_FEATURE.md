# FEATURE : Module Alimentation — Coach + Athlète

## STACK & CONTEXTE PROJET

- **Framework** : React + Vite + TypeScript
- **Style** : Tailwind CSS + shadcn/ui (`components.json` présent)
- **Base de données** : Supabase (PostgreSQL) — dossier `supabase/` présent
- **Auth** : deux rôles distincts avec vues séparées — Coach (`/coach`) et Athlète (`/athlete`)
- **Composant principal** : `src/components/WeightliftingTracker.jsx`
- **BMR de l'athlète** : déjà stocké en base dans la table `athletes`

Avant toute implémentation, lis les fichiers existants suivants pour comprendre les patterns déjà utilisés :
- `src/components/WeightliftingTracker.jsx` (structure des onglets, hooks, appels Supabase)
- `src/lib/` ou équivalent (helpers Supabase existants)
- `supabase/migrations/` (schéma existant)

Reproduis exactement les patterns existants (nommage, structure des hooks, style Tailwind/shadcn).

---

## 1. BASE DE DONNÉES — Migrations Supabase

Crée deux nouvelles migrations dans `supabase/migrations/`.

### Table `nutrition_strategy`
Stratégie nutritionnelle définie par le coach pour un athlète.

```sql
CREATE TABLE nutrition_strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  strategy TEXT NOT NULL CHECK (strategy IN ('maintenance', 'seche', 'prise_de_masse')),
  can_track_calories BOOLEAN NOT NULL DEFAULT false,
  total_calories_coach INTEGER,           -- kcal/jour fixés par le coach (si can_track_calories = false)
  target_weight DECIMAL(5,2),             -- kg, affiché dans le dashboard athlète
  surplus_deficit_min DECIMAL(5,2),       -- % ex: -8.0
  surplus_deficit_max DECIMAL(5,2),       -- % ex: -5.0
  macros_glucides INTEGER,                -- grammes/jour
  macros_lipides INTEGER,                 -- grammes/jour
  macros_proteines INTEGER,               -- grammes/jour
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (athlete_id)                     -- une seule stratégie active par athlète
);
```

### Table `nutrition_daily_log`
Saisie quotidienne de l'athlète.

```sql
CREATE TABLE nutrition_daily_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  active_calories INTEGER,                -- kcal brûlées (montre/outil) — si can_track_calories = true
  total_calories_consumed INTEGER,        -- kcal mangées (saisie manuelle athlète)
  glucides_consumed INTEGER,              -- grammes
  lipides_consumed INTEGER,               -- grammes
  proteines_consumed INTEGER,             -- grammes
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (athlete_id, date)
);
```

### RLS Policies
- Athlète : `SELECT` et `INSERT/UPDATE` uniquement sur ses propres lignes (`athlete_id = auth.uid()`)
- Coach : `SELECT`, `INSERT`, `UPDATE` sur les lignes de ses athlètes

---

## 2. FICHIER DE SERVICES — `src/lib/nutrition.ts`

Crée un fichier `src/lib/nutrition.ts` avec toutes les fonctions Supabase du module.
Utilise exactement le même pattern que les autres fichiers `src/lib/*.ts` existants.

Fonctions à implémenter :
- `getNutritionStrategy(athleteId)` → retourne la stratégie active
- `upsertNutritionStrategy(data)` → coach enregistre/modifie la stratégie
- `getDailyLog(athleteId, date)` → log du jour
- `upsertDailyLog(data)` → athlète enregistre/modifie son log du jour

Toujours inclure gestion d'erreur et typage TypeScript.

---

## 3. VUE COACH — Bloc "Alimentation" dans la fiche athlète

Dans la vue coach, dans la fiche d'un athlète, ajoute un bloc ou section "Alimentation".
Reproduis le style visuel des autres sections déjà présentes dans cette vue.

### Contenu du formulaire coach

**Section Général**
- Input numérique : Poids cible (kg)
- Toggle switch (shadcn) : "L'athlète peut tracker ses calories (montre, app…)"
  - Si `false` → afficher un input : "Total calorique journalier (kcal)" fixé par le coach

**Section Stratégie**
- Select (shadcn) : `Maintenance` / `Sèche` / `Prise de masse`
- Selon la stratégie sélectionnée, afficher deux inputs min/max pour la fourchette de surplus/déficit (%) avec les plages indicatives en placeholder :
  - `seche` → placeholder : min `-20`, max `-5`
  - `maintenance` → placeholder : min `-3`, max `+3`
  - `prise_de_masse` → placeholder : min `+3`, max `+15`

**Section Macronutriments cibles**
- Trois inputs numériques : Glucides (g) / Lipides (g) / Protéines (g)
- Afficher en temps réel sous les inputs le total calorique théorique :
  `Total = (glucides × 4) + (lipides × 9) + (protéines × 4)` kcal

**Bouton "Enregistrer la stratégie"** → appelle `upsertNutritionStrategy`.
Afficher un état de chargement sur le bouton pendant l'appel. Toast succès/erreur.

---

## 4. VUE ATHLÈTE — Nouvel onglet "Alimentation"

Ajoute un onglet "Alimentation" dans la navigation de la vue athlète,
au même niveau et avec le même style que les onglets existants dans `WeightliftingTracker.jsx`.

Si aucune stratégie n'a encore été définie par le coach, afficher :
> "Aucune stratégie nutritionnelle n'a encore été définie par ton coach."

### Bloc 1 — Résumé stratégie (lecture seule)

- Badge stratégie (couleur différente selon : Maintenance / Sèche / Prise de masse)
- Poids cible : `XX kg`
- Total calorique dépensé du jour :
  - Si `can_track_calories = true` → `BMR + active_calories saisis` (mis à jour en temps réel quand l'athlète saisit)
  - Si `can_track_calories = false` → valeur fixée par le coach
- Macros cibles : `Glucides : Xg | Lipides : Xg | Protéines : Xg`
- Fourchette objectif : `ex. -8% à -5%`

### Bloc 2 — Saisie quotidienne

- Si `can_track_calories = true` : input "Calories actives (kcal)" avec label explicatif "Calories brûlées selon ta montre/app"
- Input : "Total calories consommées (kcal)"
- Inputs : Glucides consommés (g) / Lipides consommés (g) / Protéines consommées (g)
- Bouton "Enregistrer" → `upsertDailyLog` pour `date = today`
- Après enregistrement, les champs restent éditables (pas de mode read-only)
- Toast succès/erreur

### Bloc 3 — Feedback (visible uniquement si `total_calories_consumed` est renseigné)

**Calcul :**
```
surplus_deficit_pct = ((total_calories_consumed - total_calories_depensees) / total_calories_depensees) × 100
```

**Logique d'affichage :**

- Si `surplus_deficit_pct` est compris entre `surplus_deficit_min` et `surplus_deficit_max` :
  → Bandeau **vert** :
  `✅ Excellent ! Tu respectes ton plan [stratégie]. Continue comme ça !`

- Si hors fourchette :
  → Bandeau **orange** :
  `⚠️ Tu es à [X.X]% aujourd'hui. Ton objectif est entre [min]% et [max]%. Ajuste ton prochain repas, tu es sur la bonne voie !`

Afficher également sous le feedback la valeur numérique du surplus/déficit du jour :
`Surplus/Déficit du jour : +X.X% ([+/-]YYY kcal)`

---

## 5. DASHBOARD ATHLÈTE — Mise à jour des cartes existantes

Le dashboard athlète contient déjà des cadres pour "Poids cible" et "Stratégie".
Branche-les sur les données réelles depuis `nutrition_strategy` :
- Carte "Poids cible" → `target_weight` (en kg)
- Carte "Stratégie" → badge avec le nom de la stratégie active

Si `nutrition_strategy` est null pour cet athlète, afficher `—` dans ces cartes.

---

## CONTRAINTES FINALES

- Ne pas modifier le comportement des fonctionnalités existantes
- Tous les composants UI doivent utiliser shadcn/ui (Button, Input, Select, Switch, Badge, Toast)
- Tailwind uniquement pour le style custom — pas de CSS inline
- Typage TypeScript strict sur toutes les nouvelles fonctions et composants
- Les appels Supabase se font uniquement via `src/lib/nutrition.ts`
- États `loading` et `error` gérés sur chaque appel async
