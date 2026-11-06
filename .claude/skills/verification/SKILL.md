---
name: verification
description: Commandes de vérification de WM Collection et format des preuves - avant une PR (agents dev) et vérification finale de feature (verifier).
---

# Vérification

## Avant la PR (agents dev)
Dans le worktree :
```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e        # si la tâche touche l'UI ou un parcours
```
Colle dans la PR la fin de chaque sortie (résumé Vitest/Playwright, fin du build Vite). Un avertissement de lint **nouveau** est à corriger.

Si la tâche touche le hook : `node .claude/hooks/garde-fous.test.mjs`.

## Vérification de feature (verifier)
```bash
npm ci
npm run lint; npm run typecheck; npm test; npm run build; npm run test:e2e
```
Pour chaque SC, une ligne de matrice : `SC-xxx | T-xxx | test (fichier › nom) | preuve | ✅/❌`.
- Preuve = commande exacte + extrait de sortie (≤ 5 lignes) ou capture `specs/<feature>/captures/<nom>.png`.
- Un SC sans test automatisé : preuve manuelle reproductible (étapes + capture), signalée « manuel ».
- Un SC non prouvé est ❌, même si « ça a l'air de marcher ».
- Ne vérifier sur le vrai site qu'avec le compte d'Alexis et en sa présence ; pas de capture réelle dans le dépôt.
