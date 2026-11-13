# Retouches — retrait de l'import et de l'export

Import et export de fichier retirés le 2026-11-12 (demande d'Alexis, voir #87).

## À reprendre

Rien.

## Fait

- `tests/e2e/etiquettes.spec.ts` : plus de `carteComplete` en double, la version de `extension.ts` est réutilisée avec `decidePar: 'assistant'`.
- `CarteImportee` → `CarteLueSite`, `fusionnerImport` → `fusionnerCartesLues` (`src/lib/collection.ts`, `stockage.ts`, `lecteur.ts`, tests).
- `specs/synchro-complete/{spec.refined,plan,tasks}.md` : note « Retiré le 2026-11-12 » en tête.
