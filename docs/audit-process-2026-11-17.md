# Audit des process — 2026-11-17

Périmètre : synchro (pages, stats, prix, ventes), lots (aperçu, file d’écriture, enchères, défausses, étiquettes, favoris), classement (Wikipédia, Wikidata, API Claude, export/import), relevé d’affluence. Lecture du code de `src/` et du cadre d’usage d’`AGENTS.md`. Aucune règle de sécurité n’a été touchée.

## 1. Doublons de code (corrigés dans cette PR, comportement identique)

| Doublon | Où | Correction |
|---|---|---|
| `estObjet` / `objet` copiée 8 fois | `sauvegarde`, `wikipedia`, `lectureApi`, `stockage`, `collection`, `etatExecution`, `statutSynchro` | `src/lib/valider.ts` |
| `estEntier` / `entier` / `entierPositif` copiée 4 fois | `lectureApi`, `etatExecution`, `statutSynchro`, `journal` | idem |
| `tronquer` copiée 2 fois | `journal`, `etatExecution` | idem |
| `attendreReel` copiée 2 fois | `classerIA`, `verifierWikipedia` | `src/app/attente.ts` |
| Supplément aléatoire 0–100 ms écrit en ligne 2 fois, plus `SUPPLEMENT_MAX_MS` (100) et `GIGUE_MAX_MS` (100) définis séparément | `pilotageLots`, `file`, `gigue` | `SUPPLEMENT_MAX_MS = GIGUE_MAX_MS`, un seul helper dans `pilotageLots` |
| Pause de 30 min définie deux fois (`PAUSE_LOTS_MS`, `PAUSE_APRES_ARRET_MS`) | `reprise`, `ordonnanceur` | la seconde reprend la première |

## 2. Règles qui se contredisent ou ont dérivé (non modifiées : à trancher)

1. **Relevé d’affluence : 3 échecs → pause de 30 min** (`synchroAuto.ts`, `MAX_ECHECS_RELEVE`). Les autres process ont retiré l’arrêt sur 3 échecs (lots 2026-11-15, lecture 2026-11-16, prix 2026-11-16), et `AGENTS.md` ne cite pour l’affluence que 401/403/429. Seule règle « 3 échecs » encore active côté lecture. Question 1.
2. **403 : pause selon le process.** Lots : pas de pause sur 403 (2026-11-15). Synchro de lecture : pause de 30 min sur 401/403/429 des pages et stats (`ordonnanceur`, `PAUSE_APRES_ARRET_MS`) ; le bouton « Relancer » ne couvre que l’arrêt manuel et le 403. Cohérent avec `AGENTS.md`, mais deux régimes pour le même code. Rien à changer sans décision.
3. **Code mort : raison d’arrêt `echecs` de la synchro de lecture** (`RaisonArretSynchro`, `synchroAuto.ts:164`, `:360`). L’ordonnanceur ne la produit plus depuis le 2026-11-16. Elle sert encore à lire d’anciens statuts stockés ; à retirer après la prochaine migration de `statutSynchro`.
4. **Documentation** : `AGENTS.md` empile dans le cadre d’usage les règles remplacées (6 s → 0,2 s, 3 échecs, pauses de prix de 30 à 240 s, lots de 30 prix), avec des mentions « remplace tout ce qui précède ». Lisible seulement avec l’historique. Proposition : réécrire la section « état courant » en un tableau par process et déplacer l’historique dans `docs/archives/`.
5. **`MAX_ECHECS` à trois valeurs** : écritures 3 (`file.ts`), Wikipédia/Wikidata 3, classement IA 5, relevé 3. Intentionnel (coût et risque différents), mais jamais exposé dans un seul tableau. À documenter.
6. **« Sans thème fiable » / « à classer »** : trois formulations (`sans-theme-fiable`, `a-classer`, `estACLasser`) mais une seule règle effective (`lot.ts`, `revision.ts`, `selectionLot.ts` passent tous par `estACLasser`). Aucune contradiction trouvée ; le libellé « à classer » désigne aussi les cartes qui portent encore l’ancienne étiquette « #À classer ».
7. **Statut** : aucune pose « Statut · … » restante dans le code ; seule la lecture de « Statut · Vendre » (préremplissage) subsiste. Conforme à la décision du 2026-11-14.
8. **Limite de 5 enchères** : le maximum vient du site (`ventesSite`) avec repli sur `config/prix.ts` ; relecture `marketplace/mine` au « Lancer » seulement. Cohérent.
9. **Prix** : plus d’arrêt automatique, avertissement dès le 5e échec avec « Passer cette carte » ; seul le 404 est mémorisé. Cohérent avec la décision du 2026-11-16. Rappel d’`AGENTS.md` : la durée restante sous-estime les prix (0,25 s par requête contre ~1,5 s réelle avec la pause de 1,2 s).

## 3. Optimisations proposées (non faites, hors « sans régression » évidente)

- **Durée restante des prix** : utiliser l’intervalle réel (intervalle + `PAUSE_PRIX_MS` + gigue moyenne) pour l’estimation. Purement affichage.
- **Doc** : point 4 ci-dessus.
- **Code mort** : point 3, avec migration.

## 4. Garde-fous vérifiés inchangés

Anti-bot (`human_verification_required` jamais contourné), 401/429, intervalle 0,2 s + gigue, 3 en vol au plus, bail, revérification avant envoi, plafond de défausse, listes de routes, permissions du manifeste. Contrôles : `npm run check` (lint, types, 1 951 tests) vert avant et après.
