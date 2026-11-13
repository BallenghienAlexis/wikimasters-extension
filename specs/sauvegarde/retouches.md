# Retouches — sauvegarde

## À reprendre
- Registre des étiquettes posées par l'extension (`registre`) : non sauvegardé. Sur un 2ᵉ PC du même compte, l'extension ne saura pas retirer ses étiquettes déjà posées tant que le registre n'est pas transféré (fusion à définir dans `src/lib/registre.ts`).
- Journal d'exécution des lots (`journal`) : non sauvegardé (historique, non nécessaire pour reprendre le travail).
- Captures de la section « Sauvegarde complète » (3 breakpoints, clair/sombre) : non faites ; à ajouter sur le modèle de `tests/e2e/plafond-defausse.spec.ts`.
- src/lib/sauvegarde.ts:72 et :130 : `syncAuto` est écrit et exigé, mais l'import l'ignore (interrupteur d'ici conservé). Le rendre facultatif dans une prochaine version du format.
