# Vérification — Thèmes précis et étiquettes de thème et d’échange

- **Commit vérifié** : `a715cd9` (branche `feat/T-904-retouches`, sur `origin/main` = `f33ef11`) · **Date** : 2026-11-09 · **Agent** : session principale (rôle verifier)

## Commandes
| Commande | Résultat |
|---|---|
| `npm ci` | non rejoué : `node_modules` partagé par lien symbolique depuis le worktree T-104 |
| `npm run lint` | ✅ sans erreur |
| `npm run typecheck` | ✅ sans erreur |
| `npm test` | ✅ 32 fichiers, 1 172 tests |
| `npm run build` | ✅ |
| `CI=1 npm run test:e2e` | ✅ 45 tests |

## Matrice SC → tâche → test → statut
Les tests sont dans `tests/unit/` sauf mention. Les numéros de SC-001 à SC-025 sont ceux de `spec.refined.md`.

| SC | Tâche | Test | Preuve | Statut |
|---|---|---|---|---|
| SC-001 | T-101 | `themes.test.ts` › « contient les 60 nouveaux identifiants avec libellés et parents (SC-001) » ; « a des parents existants, clos, sans cycle ni doublon » ; « trie IDS_THEMES par libellé, « autres » en dernier » | `npm test` | ✅ |
| SC-002 | T-101 | `themes.test.ts` › « fige les identifiants et libellés existants (SC-002) » | `npm test` | ✅ |
| SC-003 | T-101 | `themes.test.ts` › « a des libellés utilisables comme noms d’étiquette (SC-003) » | `npm test` | ✅ |
| SC-004 | T-101 | `themes.test.ts` › « détection des thèmes précis (SC-004, SC-023) » dont « donne chien, animaux et nature au berger allemand » | `npm test` | ✅ |
| SC-005 | T-101 | `themes.test.ts` › « faux positifs (SC-005, SC-023) » dont « range « Chevalier » dans le Moyen Âge » | `npm test` | ✅ |
| SC-006 | T-101 | `themes.test.ts` › « non-régression (SC-006) » | `npm test` | ✅ |
| SC-007 | T-103 | `tri.test.ts` › « cohérence tri et thèmes précis (SC-007) » ; « amisConcernes (H13) » ; « lirePreferences » | `npm test` | ✅ |
| SC-008 | T-104 | `lot-etiquettes.test.ts` › « étiquettes attendues (SC-008) » ; « lot : créations, poses, ordre (SC-008) » | `npm test` | ✅ |
| SC-009 | T-104 | `lot-etiquettes.test.ts` › « homonymes et longueur (SC-009, SC-021) » | `npm test` | ✅ |
| SC-010 | T-104 | `lot-etiquettes.test.ts` › « limites du site (SC-010) » ; « corrections de revue (SC-010, SC-021) » | `npm test` | ✅ |
| SC-011 | T-104 | `lot-etiquettes.test.ts` › « retraits (SC-011, SC-022) » | `npm test` | ✅ |
| SC-012 | T-105 | `revision.test.ts` › « reverifierAction : thèmes et échanges (T-105, SC-012, H12) » dont le test croisé avec `construireLot` | `npm test` | ✅ |
| SC-013 | T-102 | `registre.test.ts` › « registre : plus de plafond de 2 couples (SC-013) » ; « migration v1 → v2 et bornes (SC-013, SC-018) » (idempotence, 256/257 couples) | `npm test` | ✅ |
| SC-014 | T-106, T-108, T-109 | logique : `apercu-etiquettes.test.ts` › « regrouperEtiquettes : lignes (AC1) » ; rendu : `etiquettes-prevues.test.ts` › « EtiquettesPrevues : lignes (AC1) » ; e2e : `etiquettes.spec.ts` › « liste les étiquettes prévues avec leurs nombres, sans requête ni lecture du jeton » | `npm test`, `CI=1 npm run test:e2e` | ✅ |
| SC-015 | T-108, T-109 | `etiquettes-prevues.test.ts` (avertissement) ; e2e : « l’avertissement de visibilité précède « Lancer » quand une étiquette est attendue, et manque sinon » | `CI=1 npm run test:e2e` | ✅ (texte) — visibilité réelle des étiquettes non relevée, comme prévu |
| SC-016 | T-106, T-108 | `apercu-etiquettes.test.ts` › « totaux et durée (AC2) », « non posées et plafond (AC3, AC4) » ; `etiquettes-prevues.test.ts` ; e2e : « liste les étiquettes prévues… » | `npm test`, e2e | ✅ |
| SC-017 | T-101, T-104, T-106, T-109, T-901 à T-903 | `themes.test.ts` › « détecte les thèmes de 5 000 cartes en moins de 200 ms » ; `lot-etiquettes.test.ts` › « construit le lot de 5 000 cartes… en moins de 500 ms » ; `apercu-etiquettes.test.ts` › « 5 000 cartes… moins de 500 ms » ; e2e : « 5 000 cartes : l’aperçu s’affiche en moins de 500 ms… » | `npm test`, e2e | ✅ |
| SC-018 | T-102, T-106 | `registre.test.ts` › « pèse au plus 5 Mo pour 5 000 exemplaires à 12 couples » ; arrêt sur échec d’écriture déjà couvert par `synchro-complete` (SC-011 (b)) | `npm test` | ✅ |
| SC-019 | T-108, T-109 | e2e : « se déplie au clavier ; un nom de 300 caractères ne déborde pas à 375 px » ; « aperçu des étiquettes sans défilement horizontal » (clair/sombre × 3 largeurs) ; « prefers-reduced-motion : aucune animation… » | `CI=1 npm run test:e2e` | ✅ — contraste AA : tokens existants, aucune couleur ajoutée (DT-01) ; relecture visuelle des captures par Alexis à prévoir |
| SC-020 | T-101, T-109 | `exports.test.ts` › « exports et thèmes précis (SC-020) » ; e2e : export CSV avec nouveaux libellés | `npm test`, e2e | ✅ |
| SC-021 | T-104 | `lot-etiquettes.test.ts` › « étiquettes d’échange (SC-021, SC-025) » | `npm test` | ✅ |
| SC-022 | T-104 | `lot-etiquettes.test.ts` › « retraits (SC-011, SC-022) » dont « retire « #À échanger Léa » quand Léa ne suit plus aucun thème… » | `npm test` | ✅ |
| SC-023 | T-101 | `themes.test.ts` › « détection des thèmes précis (SC-004, SC-023) » ; « faux positifs (SC-005, SC-023) » | `npm test` | ✅ |
| SC-024 | T-103, T-107 | `tri.test.ts` › « fusionnerAmisInitiaux (SC-024) » (dont le cas de la casse, T-904) ; `stockage.test.ts` › « amis initiaux (SC-024) » AC1 à AC6 (prénoms fictifs depuis T-904) | `npm test` | ✅ |
| SC-025 | T-103, T-104 | `lot-etiquettes.test.ts` › « Benji (barrage, tibet) et Anna (ukraine) : étiquettes d’échange (SC-025) » ; `tri.test.ts` › « cohérence tri et thèmes précis » | `npm test` | ✅ |

## Écarts
| SC | Constat | Tâche à rouvrir |
|---|---|---|
| SC-015 | Le texte est vérifié ; le caractère public ou privé des étiquettes sur le site reste à relever (hors périmètre, T-024 de `synchro-complete`). L’avertissement doit rester affiché. | aucune |
| SC-024 / SC-025 | La spec cite Benjamin et Anatole ; les tests utilisent des prénoms fictifs (G2) et `AC1` vérifie les thèmes `barrage`, `tibet`, `ukraine` du fichier réel sans citer de prénom. | aucune |
| SC-019 | Les contrastes reposent sur les tokens existants ; aucun calcul automatique de ratio n’est joué par la suite de tests. | aucune |

## Captures
Générées par `CI=1 npm run test:e2e` dans `test-results/captures/etiquettes-<thème>-<largeur>.png` (non versionnées, comme pour les autres features).
