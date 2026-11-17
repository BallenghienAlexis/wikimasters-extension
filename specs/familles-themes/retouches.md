# Retouches : familles de thèmes (PR #185)

## À reprendre
- `src/lib/sauvegarde.ts` : les thèmes appris (`themesAppris`, renommages, fusions, suppressions) ne sont pas dans la sauvegarde JSON. Ils se reconstruisent depuis le cache Wikipédia, mais les choix d'Alexis ne suivent pas un changement de PC. Décision à prendre : les ajouter à la sauvegarde (liste blanche, version de format).
- `tests/e2e/themes.spec.ts` (absent) : parcours clavier de l'onglet Thèmes (déplier, cocher une famille, recherche) et captures aux 3 tailles.
- `src/lib/themesAppris.ts` (`proposerThemes`) : le nom d'une catégorie devient une étiquette visible des autres joueurs. Marquer « nouveau thème appris » dans l'aperçu du lot, ou valider à la création (point mineur de la revue de sécurité).
- `src/app/CarteLigne.tsx` : fusion avec la PR #183 (éditeur de thèmes) faite dans la PR #185 ; relire l'affichage si #183 évolue.
