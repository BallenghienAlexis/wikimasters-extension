# Contribuer

- **Idée ou bug** : ouvre une issue avec le formulaire (« Suggestion » ou « Bug »). Elle est triée automatiquement.
- **Faille de sécurité** : voir `SECURITY.md`, jamais en issue publique.
- **Code** : fork, branche `feat/…`, PR vers `main`. Une PR doit passer la CI `ci` (`npm run check`, `npm run build`, `npm run test:e2e`), suivre `AGENTS.md` (français, tokens de couleur, aucune donnée réelle dans les tests) et être approuvée par le propriétaire. Les commits suivent Conventional Commits en français.
- L'extension n'agit sur WikiMasters que dans le cadre décrit dans `AGENTS.md` ; toute PR qui l'élargit est refusée sans décision écrite du propriétaire.
