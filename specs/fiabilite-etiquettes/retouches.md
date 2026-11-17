# Retouches — fiabilité des étiquettes (2026-11-17)

## À reprendre

Points mineurs de la revue de la PR « mode des étiquettes », reportés avec leur détail :

1. `tests/e2e/extension.ts` (`ouvrirSectionsReglages`) et `tests/e2e/refonte-reglages.spec.ts` (`SECTIONS`, SC-028 « sept sections ») : la section « Étiquettes sur le site » (`ModeEtiquettes.tsx`) n'est ni ouverte ni capturée. Ajouter la section, un parcours (choix d'un mode, résumé mis à jour, aucune requête) et les captures aux 3 breakpoints.
2. `src/lib/sauvegarde.ts` (liste blanche, l. 66-70, 99, 200-203) : `modeEtiquettes` n'est pas emporté ; après restauration, le mode retombe sur `suspendre` (sans danger). Décider : l'ajouter à la liste blanche avec un test, ou garder la limite.
3. `AGENTS.md` : ajouter au journal « Cadre d'usage WikiMasters » un court paragraphe daté du mode des étiquettes (aujourd'hui dans le tableau et l'Architecture).
4. `src/lib/lot.ts` (l. 404-415) : en mode `retirer-tout`, le lot propose encore les favoris (règle des thèmes gardés, choix manuels). Soit préciser « retraits d'étiquettes » dans la documentation, soit exclure les favoris dans ce mode, avec un test.
5. `src/lib/lot.ts` (l. 57) et `src/lib/revision.ts` : le défaut d'une `Config` sans mode est `poser`, alors que les préférences donnent `suspendre`. Aligner sur `suspendre` ou rendre le champ obligatoire.
6. Repose des étiquettes depuis le fichier « Télécharger la liste des étiquettes posées » : non câblée (la réapplication passe par le mode `poser`).
7. Revue de la PR #191 : retirer `compterThemes` (`src/lib/themes.ts`) et son test s'il n'est plus utilisé ; remplacer le test de durée de `tests/unit/tags-carte.test.ts` par un compteur d'appels ; préciser dans `AGENTS.md` que « Autres » = cartes sans étiquette posée ni thème prévu.
