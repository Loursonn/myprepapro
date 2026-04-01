# MyPrepaPro

Application de suivi d'athlètes en préparation physique, destinée aux coachs et à leurs athlètes.
Développée d'abord pour un usage personnel (un coach + ses athlètes), avec une architecture pensée pour évoluer vers une plateforme multi-coachs.

**Objectif final : application mobile iOS + Android** (priorité sur le mobile).

---

## Stack technique

| Couche | Outil | Notes |
|--------|-------|-------|
| Frontend | React 18 + TypeScript + Vite | App web actuelle (prototype Lovable) |
| UI | shadcn/ui + Tailwind CSS | Composants déjà en place |
| Backend / BDD | Supabase (PostgreSQL) | Données + auth + Edge Functions |
| IA | Google Gemini 2.5 Flash | Génération de programmes via Edge Function |
| Mobile (cible) | React Native + Expo | Migration à planifier depuis la base web |
| Routing | React Router v6 | |
| Data fetching | TanStack React Query v5 | |
| Charts | Recharts | Courbes de progression |
| Formulaires | React Hook Form + Zod | |

---

## Architecture actuelle (à refactoriser)

Le prototype Lovable est fonctionnel mais tout le code est dans un seul fichier :
- `src/components/WeightliftingTracker.jsx` — **1 745 lignes**, contient toute l'app

### Structure cible (refactorisation progressive)

```
src/
├── pages/
│   ├── athlete/
│   │   ├── Dashboard.tsx
│   │   ├── Session.tsx
│   │   └── Stats.tsx
│   └── coach/
│       ├── Programs.tsx
│       ├── Exercises.tsx
│       ├── Athletes.tsx
│       ├── Stats.tsx
│       └── Settings.tsx
├── components/
│   ├── ui/              (shadcn — ne pas modifier)
│   ├── athlete/         (composants vue athlète)
│   └── coach/           (composants vue coach)
├── hooks/               (logique métier réutilisable)
├── lib/
│   └── supabase.ts
└── integrations/
    └── supabase/
```

---

## Base de données (Supabase)

### État actuel
Une seule table `app_data` (clé-valeur JSONB) — pas d'authentification, pas de multi-utilisateurs.

### Schéma cible (à migrer)

```sql
-- Utilisateurs (géré par Supabase Auth)
-- profiles : coach ou athlète

profiles (id, role: 'coach'|'athlete', full_name, avatar_url, coach_id?)

-- Structure entraînement
programs       (id, coach_id, name, description, created_at)
blocks         (id, program_id, week_start, week_end, is_deload)
sessions       (id, block_id, label, day_of_week)
exercises      (id, name, bloc, target, ex_type, tier)
session_exercises (id, session_id, exercise_id, order, weeks_config JSONB)

-- Suivi athlète
workout_logs   (id, athlete_id, session_id, date, completed)
set_logs       (id, workout_log_id, exercise_id, set_num, kg, reps, rir, method)
wellness_logs  (id, athlete_id, date, fatigue, sleep, stress, energy, doms JSONB)
body_weight    (id, athlete_id, date, weight_kg)
injuries       (id, athlete_id, zone, description, date_start, date_end)
pr_logs        (id, athlete_id, exercise_id, kg, date)
```

---

## Fonctionnalités

### MVP (phase 1 — pour usage personnel)

**Vue Athlète**
- [ ] Accueil : dashboard motivation, bien-être du jour, prochaine séance
- [ ] Séance : déroulement set par set, méthodes avancées (dropset, myoreps…), RPE/RIR
- [ ] Stats : courbes de progression, PR, poids corporel

**Vue Coach**
- [ ] Programmes : création de cycles/blocs d'entraînement (6 semaines + deload)
- [ ] Exercices : bibliothèque avec groupes musculaires, tier, méthodes
- [ ] Athlètes : liste, profil, historique
- [ ] Stats : vue globale de ses athlètes
- [ ] Paramètres : gestion du compte, méthodes custom

**Transversal**
- [ ] Authentification (Supabase Auth) — rôles coach / athlète
- [ ] Génération IA de programme (déjà développé en Edge Function)

### Phase 2 — multi-coachs
- Inscription libre pour les coachs
- Invitation d'athlètes par lien
- Abonnement / plans tarifaires
- Messagerie coach ↔ athlète

### Phase 3 — mobile natif
- Migration React Native + Expo
- Notifications push (rappel séance, feedback coach)
- Mode hors-ligne (séance sans connexion)
- Wearables (Apple Watch, Garmin)

---

## Rôles utilisateurs

| Action | Coach | Athlète |
|--------|-------|---------|
| Créer un programme | ✅ | ❌ |
| Assigner un athlète | ✅ | ❌ |
| Suivre une séance | ❌ | ✅ |
| Saisir wellness | ❌ | ✅ |
| Voir stats de ses athlètes | ✅ | ❌ |
| Voir ses propres stats | ❌ | ✅ |
| Générer programme IA | ✅ | ❌ |
| Commenter une séance | ✅ | ✅ |

---

## Métriques de suivi athlète

- **Charge** : kg × reps × séries
- **RIR** (Reps In Reserve) : échelle 0 → 5.5
- **RPE** (Rate of Perceived Exertion)
- **Bien-être** : fatigue, qualité sommeil, stress, énergie, DOMS (0-10)
- **Poids corporel** : suivi quotidien + jalons
- **PR** (records perso) par exercice
- **Blessures** : zone corporelle, durée, statut

## Méthodes d'entraînement supportées

Dropset, Myoreps, Rest-pause, Superset, AMRAP, Excentrique, Isométrique + méthodes custom coach

## Groupes musculaires

Pecs, Dos-GD, Dos-Trap, Dos-Rhom, Ep-Ant, Ep-Lat, Ep-Post, Quads, Ischios, Fessiers, Adducteurs, Triceps, Biceps, Core, Mollets

---

## Conventions de code

- **Langage** : TypeScript (pas de `.jsx`, tout en `.tsx`)
- **Composants** : un composant = un fichier, PascalCase
- **Hooks custom** : préfixe `use`, dans `src/hooks/`
- **Noms de fichiers** : PascalCase pour composants, camelCase pour utils/hooks
- **Imports** : alias `@/` pour `src/`
- **Styling** : Tailwind uniquement, pas de CSS inline
- **Requêtes BDD** : toujours via hooks React Query, jamais directement dans les composants

---

## Workflow Git (multi-contributeurs)

### Branches
- `main` — production (Vercel déploie automatiquement depuis main)
- `dev` — branche de développement partagée, base de travail quotidienne
- `feat/xxx` ou `fix/xxx` — branches individuelles, créées depuis `dev`

### Démarrer une session de travail
```bash
git fetch origin
git checkout dev
git pull origin dev
git checkout -b feat/nom-de-la-feature
```

### Sauvegarder et partager
```bash
git add fichier-modifie.tsx
git commit -m "description courte"
git push origin feat/nom-de-la-feature
```

### Fusionner vers dev (Pull Request sur GitHub)
1. Ouvrir une PR : `feat/xxx` → `dev`
2. Faire reviewer par l'autre
3. Merger

### Mise en production
Quand `dev` est stable : PR `dev` → `main` → Vercel redéploie automatiquement.

### Règles importantes
- **Ne jamais pusher directement sur `main`**
- **Toujours partir de `dev` à jour** avant de créer une branche
- Un seul contributeur à la fois sur `WeightliftingTracker.jsx` (fichier monolithique 2500+ lignes)

---

## Commandes essentielles

```bash
# Installer les dépendances
npm install

# Démarrer en local (ouvre dans le navigateur)
npm run dev

# Build production
npm run build

# Tests
npm run test
```

---

## Variables d'environnement (.env)

```
VITE_SUPABASE_URL=        # URL de votre projet Supabase
VITE_SUPABASE_ANON_KEY=   # Clé publique Supabase
```

---

## Fichiers importants

- `src/components/WeightliftingTracker.jsx` — composant monolithique actuel (à refactoriser)
- `supabase/functions/ai-program/index.ts` — Edge Function génération IA
- `supabase/migrations/` — historique des migrations BDD
- `src/integrations/supabase/types.ts` — types auto-générés Supabase

---

## Priorités immédiates

1. **Faire tourner l'app en local** (`npm install` + `npm run dev`)
2. **Connecter Supabase** (configurer les variables d'environnement)
3. **Ajouter l'authentification** (Supabase Auth avec rôles coach/athlète)
4. **Refactoriser** WeightliftingTracker.jsx en composants séparés
5. **Migrer le schéma BDD** vers le modèle relationnel cible
