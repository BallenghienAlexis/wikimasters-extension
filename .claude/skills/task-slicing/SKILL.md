---
name: task-slicing
description: Règles pour découper un plan SDD en tâches atomiques avec un brief de contexte autosuffisant. Utilisé par l'agent tasks.
---

# Découpage en tâches

## Une tâche est atomique si
- elle produit **un** livrable mergeable seul sans casser `main` (build, tests verts) ;
- elle tient en une PR lisible (≈ 300 lignes de diff hors lockfile, 1 couche) ;
- sa liste de fichiers est **fermée** : le dev n'a pas le droit d'en toucher d'autres ;
- un seul agent dev la réalise (la couche détermine l'agent : ui → dev-ui, logique/données → dev-core, infra → dev-infra, tests → dev-test, docs → dev-core).

## Parallélisme
`[P]` seulement si la tâche n'a aucune dépendance non mergée de sa vague **et** ne partage aucun fichier avec une autre tâche de la vague. Fichiers « carrefour » (`src/styles/tokens.css`, `public/manifest.json`, `package.json`, `src/lib/collection.ts`) : une seule tâche par vague.

## Tests attendus
Pour chaque critère d'acceptation, le type de test (unitaire `tests/unit/…`, e2e `tests/e2e/…`, capture) et son nom de fichier. `dev-test` les écrira avant le code.

## Brief de contexte (autosuffisant)
Le dev ne lira que ce brief, la spec affinée et design/plan. Il doit contenir :
1. **Pourquoi** en 2 lignes (SC servis).
2. **État actuel** des fichiers concernés : fonctions, classes, lignes utiles (`fichier:ligne`).
3. **À faire** : comportement attendu, signatures/exports exacts si une autre tâche en dépend.
4. **Contrats** : règles `D-xx` à respecter, conventions d'`AGENTS.md` pertinentes.
5. **Pièges** connus (service worker éphémère, `chrome.*` absent dans Vitest, structure du site changeante…).
6. **Commandes** pour vérifier localement.
