## Tâche
<!-- T-xxx : lien vers specs/<feature>/tasks.md#t-xxx -->

**Couche** : ui | logique | données | infra | tests | docs
**SC couverts** : SC-xxx
**Règles design** : D-xx (si UI)

## Résumé
<!-- Ce que la PR change, en 2-4 lignes -->

## Preuves
<!-- Fin de sortie de : npm run lint · npm run typecheck · npm test · npm run build · npm run test:e2e -->

## Captures (UI)
<!-- mobile 375 · tablette 768 · desktop 1280 (par thème si concerné) -->

## Checklist
- [ ] Tests écrits avant le code (premier commit `test(T-xxx): …`) et verts
- [ ] Seuls les fichiers listés dans la tâche sont modifiés
- [ ] `npm run check` et `npm run build` passent
- [ ] UI : `design.md` respecté, captures jointes, clavier et contrastes AA vérifiés
- [ ] Aucune donnée personnelle réelle, aucun secret, rien de `captures-site/`
- [ ] Manifeste : toute permission ajoutée est justifiée ci-dessus
- [ ] Aucune action sur le site hors cadre d'`AGENTS.md`
