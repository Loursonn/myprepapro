# Journal des décisions techniques

Chaque décision importante est documentée ici avec son contexte et sa justification.
Format : `[DATE] Titre — Décision — Pourquoi`

---

## 2025-04 — Fichier monolithique conservé temporairement

**Décision** : garder `WeightliftingTracker.jsx` en un seul fichier pour l'instant.

**Pourquoi** : c'est un prototype issu de Lovable. La priorité était de valider les fonctionnalités rapidement. La refactorisation est prévue en Phase 2 une fois le MVP stabilisé.

**Impact** : un seul contributeur à la fois sur ce fichier pour éviter les conflits Git.

---

## 2025-04 — Persistance JSONB (app_data) au lieu d'un schéma relationnel

**Décision** : utiliser une table clé-valeur JSONB `app_data` pour stocker toutes les données.

**Pourquoi** : rapidité de développement sur le prototype. Le schéma des données évolue encore (nouvelles features). Un schéma relationnel rigide ralentirait les itérations.

**Plan de migration** : Phase 2 — migration vers schéma relationnel complet (voir `DATABASE.md`).

---

## 2025-04 — Clé Supabase nommée VITE_SUPABASE_PUBLISHABLE_KEY

**Décision** : utiliser `VITE_SUPABASE_PUBLISHABLE_KEY` (et non `VITE_SUPABASE_ANON_KEY`).

**Pourquoi** : nom généré automatiquement par Lovable. C'est la même clé anonyme Supabase, juste nommée différemment.

**À noter** : dans Vercel, configurer `VITE_SUPABASE_PUBLISHABLE_KEY` (pas `VITE_SUPABASE_ANON_KEY`).

---

## 2025-04 — Ajout type Haltérophilie (4ème type d'exercice)

**Décision** : ajouter `halterophilie` comme type distinct de `muscu`.

**Pourquoi** : les exercices d'haltérophilie (arraché, épaulé-jeté, etc.) ont une logique de charge identique à muscu (kg, sets, RIR, méthodes) mais méritent une catégorie visuelle distincte (couleur violet `#8b5cf6`).

**Impact code** : partout où `isFlex = eType !== "muscu"`, remplacé par `eType !== "muscu" && eType !== "halterophilie"`.

---

## 2025-04 — Surcharge progressive automatique à la complétion de séance

**Décision** : quand une séance est marquée terminée, recalculer automatiquement toutes les semaines futures.

**Pourquoi** : le coach programme la semaine 1, les semaines suivantes s'adaptent aux vraies performances (pas aux valeurs théoriques prévues). Gain de temps, meilleure précision.

**Logique** : fonction `autoProgressOnComplete()` dans `WeightliftingTracker.jsx`. Utilise le `tierConfig` pour calculer la progression selon le tier (1=RIR, 2=reps, 3=charge).

---

## 2025-04 — Workflow Git : main / dev / feat

**Décision** : 3 niveaux de branches.

**Pourquoi** : deux développeurs sur le projet. `main` = production stable (Vercel). `dev` = intégration continue. `feat/xxx` = développement isolé par feature.

**Règle** : ne jamais pusher directement sur `main`. Toujours passer par une PR.

---

*Ajouter une entrée ici à chaque décision technique importante : changement d'architecture, choix de librairie, refactorisation majeure, changement de workflow.*
