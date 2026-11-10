# Vérification — Synchronisation automatique (synchro-auto)

- **Commit vérifié** : `db855af` (`origin/main`, après #52) · **Date** : 2026-11-09 · **Agent** : verifier

## Commandes
| Commande | Résultat |
|---|---|
| `npm ci` | OK (dépendances propres, `node_modules` recréé) |
| `npm run lint` | OK, aucune erreur |
| `npm run typecheck` | OK, aucune erreur |
| `npm test` | OK : `Test Files 33 passed (33)` · `Tests 1216 passed (1216)` |
| `npm run check` | OK (code de sortie 0) |
| `npm run build` | OK : `dist/content.js 44.66 kB │ gzip: 15.16 kB` |
| `CI=1 npm run test:e2e -- --trace off` | OK : `58 passed (1.7m)` |

L’arbre de travail reste propre après les e2e (captures identiques à celles de T-206).

## Matrice SC → tâche → test → statut
| SC | Tâche | Test | Preuve | Statut |
|---|---|---|---|---|
| SC-001 | — (manuel) | `releve-api.md` | Relevé du 2026-11-09 : authentification par cookies de même origine, formes de `my-collection` et de `stats`, page hors limites → 200 avec `collection: []`. **Les formes d’erreur 401 et 429 ne sont pas relevées** (le code se fonde sur le seul numéro de statut). | ⚠️ partiel |
| SC-002 | T-205, T-207 | `tests/e2e/synchro-auto.spec.ts` › « activée sans synchro récente : stats puis pages jusqu’à la fin… (SC-002) » ; `tests/unit/synchro-auto.test.ts` › « première synchro : lit stats, pages et prix… » | e2e : `✓ 56 … (SC-002) (18.6s)` ; ordonnanceur : `1 + 2` requêtes pour 2 cartes (`stats`, page 1, page vide) | ✅ |
| SC-003 | T-203, T-207 | `tests/unit/ordonnanceur.test.ts` › « ne fait que `stats` quand total, doublons et étiquettes sont inchangés » ; e2e › « total inchangé… une seule requête, stats (SC-003) » | unitaire : `['/api/my-collection/stats?sort=rarity']` ; e2e `✓ 57` | ✅ |
| SC-004 | T-203 | `tests/unit/ordonnanceur.test.ts` › « arrêt anticipé : 20 nouvelles cartes en tête… » ; « total en baisse… » ; « doublon par count… » ; « tri par date non confirmé : repli… » | Activé le 2026-11-10 (PR #54) : pages lues en `sort=added` (plus récent d’abord), arrêt à la première page identique seulement si le total a augmenté, les étiquettes sont inchangées et l’écart de total est expliqué par la lecture ; sinon lecture complète. Repli en `sort=rarity` si la page 0 n’a pas de dates décroissantes. | ✅ |
| SC-005 | T-203 | `ordonnanceur.test.ts` › « sépare deux requêtes d’au moins 6 s, au plus 10 par 60 s, une seule en vol » ; « respecte la fenêtre de 60 s même quand des requêtes récentes viennent d’une exécution précédente » ; « ne fait rien si un bail non expiré est tenu » ; « deux synchros simultanées : la seconde est refusée » | `npx vitest run` : tests verts, horloge simulée ; bail partagé par `chrome.storage` pour plusieurs onglets | ✅ |
| SC-006 | T-203, T-205, T-207 | `ordonnanceur.test.ts` › « arrêt après 3 échecs… » ; `synchro-auto.test.ts` › « un arrêt du site (403) n’est pas retenté et ne note pas de synchro terminée » ; e2e › « réponse 403 : arrêt immédiat… (SC-006) » ; « T-206 D-03 : événements dans le journal » | e2e `✓ 58` ; journal : « 3 échecs : cause “3 échecs” » | ✅ |
| SC-007 | T-202, T-205, T-207 | `synchro-auto.test.ts` › « T-205 AC3 / G6 : option désactivée = 0 requête » ; e2e › « option désactivée : aucune requête vers /api/ (SC-007) » | e2e `✓ 55 … (8.8s)` (puis activation de la préférence : les requêtes partent) | ✅ |
| SC-008 | T-203, T-205 | `ordonnanceur.test.ts` › « ne modifie jamais une décision decidePar: moi (statut, prix cible, note, ami) » ; `synchro-auto.test.ts` › « une modification faite pendant la synchro n’est pas écrasée » | tests verts | ✅ |
| SC-009 | T-205 | `synchro-auto-lint.test.ts` › « jeton.ts n’est pas importé », « aucune lecture de cookie ni du stockage du site », « aucun en-tête n’est ajouté » ; `confinement-jeton.test.ts` ; `ordonnanceur.test.ts` › « enregistre après chaque page et chaque prix, sans jeton ni en-tête dans l’état » ; `synchro-auto.test.ts` › « aucun événement ne contient de corps de réponse, d’identifiant ni de jeton » | tests verts ; `fetch` avec `credentials: 'same-origin'` seulement | ✅ |
| SC-010 | T-201, T-203 | `lectureApi.test.ts` › « SC-010 : une carte de forme inattendue est ignorée et comptée… » ; `ordonnanceur.test.ts` › « ignore une carte de forme inattendue, continue et le note au journal » | tests verts | ✅ |
| SC-011 | — (manuel) | `releve-api.md` § prix | Source `GET /api/marketplace/cards/<card_id>/sales?scope=summary`, forme `summary.<rareté>.average`, 200 sans PRO ; test › « n’emploie jamais la route /sales sans ?scope=summary » | ✅ |
| SC-012 | T-201, T-202 | `lectureApi.test.ts` › « SC-012 : renvoie total, totalUnique et étiquettes converties », « convertit une carte (… étiquettes) » ; `ordonnanceur.test.ts` › « lit les pages 1, 2, … et enregistre étiquettes et favoris » ; `stockage.test.ts` | tests verts, aucune requête hors `stats`, pages et prix | ✅ |
| SC-013 | T-201, T-203 | `ordonnanceur.test.ts` › « relève d’abord les cartes à décider, puis valeur absente, puis périmée », « ne réécrit pas une valeur saisie à la main et la signale », « plafonne le nombre de prix relevés par exécution » ; cadence commune (SC-005) | tests verts ; un seul ordonnanceur pour collection, étiquettes et prix | ✅ |
| SC-014 | T-204, T-206 | `ecarts.test.ts` › « signale une étiquette attendue absente du site », « … présente sur le site mais non attendue » ; `synchro-auto-ui.test.ts` › « liste la carte, l’étiquette attendue et l’étiquette présente, en lecture seule » ; e2e › « “Arrêter” écrit la demande d’arrêt, et les écarts sont en lecture seule » | tests verts ; aucune écriture sur le site | ✅ |

## Écarts
| SC | Constat | Tâche à rouvrir |
|---|---|---|
| SC-001 | Les formes de réponse des erreurs 401 et 429 ne sont pas figées dans `releve-api.md`. Le code ne dépend que du statut HTTP, donc aucun effet fonctionnel constaté. | Aucune (relevé à compléter si Alexis en capture un). |
| SC-004 | Résolu le 2026-11-10 : arrêt anticipé activé par le tri `sort=added` (voir `releve-api.md`). | Aucune. |

Aucun SC en ❌.

## Mineurs
- `src/content/synchroAuto.ts:218` : le libellé « stockage indisponible » est trop précis (le `catch` couvre aussi un stockage illisible ou une erreur inattendue). Hors périmètre de cette PR ; à reprendre dans une retouche.
- Déclinés à T-901 (voir `STATUS.md`) : `couleur` des étiquettes non validée ; `analyserPrix` ignore `isPro` ; assertion sur les thèmes absente de `ecarts.test.ts` .

## Captures
`specs/synchro-auto/captures/T-206/synchro-auto-{light,dark}-{mobile,tablet,desktop}.png` (6 captures, régénérées par `synchro-auto-ui.spec.ts`).
