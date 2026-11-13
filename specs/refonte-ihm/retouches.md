# Retouches — refonte-ihm

## À reprendre

- **T-316 (PR #111)** : `src/lib/reseau.ts:7` cite encore `Synchronisation.tsx` dans un commentaire (fichier hors liste de T-316) ; remplacer par `pilotageLots.ts` (tâche T-9xx retouches).
- **T-303 (PR #112)** : `src/lib/ignorees.ts:72` et `:89` : une enchère ignorée est reconnue par `parametre = String(prix)` ; si le prix change avant la prochaine synchro, l’action réapparaît dans le lot. À trancher : ignorer par `(type, idCarte)` sans le prix, ou documenter que l’ignorée ne vaut que pour ce prix (effet limité : aperçu et « Lancer » restent nécessaires).
- **T-315 (PR #113)** : `ChiffreAnime` — voir verdict du reviewer sur l’espace insécable des milliers.

## Décisions

- 2026-11-13 : le composant d’aperçu de T-316 s’appelle `PanneauApercuLot.tsx` (et non `ApercuLot.tsx`) pour éviter une collision de casse avec `apercuLot.ts` sous Windows.
