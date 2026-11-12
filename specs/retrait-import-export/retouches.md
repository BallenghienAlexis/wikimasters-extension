# Retouches — retrait de l'import et de l'export (PR #85)

## À reprendre

1. `tests/e2e/extension.ts:10` et `tests/e2e/etiquettes.spec.ts:19` : deux fonctions `carteComplete` en double, aux valeurs par défaut différentes (`decidePar: null` contre `'assistant'`). À fusionner en une seule dans `extension.ts`, avec un paramètre pour les défauts.
2. `src/lib/collection.ts:58` (`CarteImportee`) et `:194` (`fusionnerImport`) : noms qui parlent encore d'« import » alors qu'ils ne servent plus qu'à la lecture du site. À renommer (par ex. `CarteLueSite`, `fusionnerCartesLues`).
3. `specs/synchro-complete/spec.refined.md:270` (H30), `plan.md:31-32`, `tasks.md:92-111` : décrivent encore `versJson`, `analyserImport` et le fichier d'échange v1. Ajouter « retiré le 2026-11-12 (PR #85) » en tête de ces passages, sans réécrire l'historique.

## Écarté

- Captures aux 3 tailles : le retrait ne change que l'en-tête ; les captures `collection-*` de l'e2e `extension.spec.ts` sont régénérées à chaque run.
