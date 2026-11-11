# Retouches — theme-etiquettes

## À reprendre (PR #58, vérification Wikipédia)

- `src/app/VerificationWikipedia.tsx` : pas de parcours e2e ni de captures aux 3 breakpoints du message de vérification automatique (navigateur Playwright absent de l'environnement du fil).
- `src/lib/themes.ts` (`definirThemesWikipedia`) : la surcouche reste un état de module ; un passage explicite du cache en paramètre de `themesDeCarte` serait plus pur mais touche tri, lot, exports et écarts.
- Décliné : retirer `host_permissions` via `origin=*` (Alexis a validé la permission explicite, documentée dans AGENTS.md).
- `tests/unit/lint-reseau.test.ts` : vérifier que `fetch` est permis dans `src/app/verifierWikipedia.ts` et interdit dans les autres fichiers de `src/app`.
- `tests/unit/stockage.test.ts` : tests de `chargerCacheWikipedia` (cache illisible → vide) et `enregistrerCacheWikipedia`.
- `src/app/verifierWikipedia.ts` (`creerPlanificateur`) : la suspension après 403/429 ne dure que jusqu'au rechargement de la page et ne vaut que pour l'onglet ; la persister (30 min, comme `synchro-auto`) avec un verrou entre onglets si Wikimédia devenait un souci.
- `tests/unit/wikipedia.test.ts` (`creerPlanificateur`) : test « cache chargé avec des entrées récentes : aucune requête pour ces titres et les entrées d'origine restent dans chaque cache écrit » ; remplacer l'attente par sondage (`attendreFin`) par une promesse de fin exposée par le planificateur.
- `src/app/verifierWikipedia.ts:134` : le compteur « x sur y » saute pour les titres déjà en cache (filtrer par `titresAVerifier` dans `demander`).
- `src/app/verifierWikipedia.ts` : deux onglets de la page de gestion ont chacun leur file et réécrivent le cache entier ; relire le stockage avant chaque écriture.
