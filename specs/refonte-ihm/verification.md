# Vérification — refonte-ihm

- **Commit vérifié** : `15b6998` (`origin/main`, T-901 #133) · **Date** : 2026-11-14 · **Agent** : verifier
- Worktree `.worktrees/verif-refonte`, branche `sdd/refonte-ihm-verification`.

## Commandes
| Commande | Résultat |
|---|---|
| `npm ci` | OK |
| `npm run lint` | OK, aucun avertissement |
| `npm run typecheck` | OK |
| `npm test` | `Test Files 61 passed (61)` · `Tests 1888 passed (1888)` |
| `npm run build` | OK (`dist/content.js 64.71 kB`) |
| `CI=1 npx playwright test` | 318 passed, 1 échec : `etiquettes.spec.ts:212` (5 000 cartes < 500 ms). Intermittent connu (`retouches.md`, T-308) : relancé seul 2 fois, `1 passed` (3,6 s et 4,2 s). |

Note d'environnement : le Chromium de Playwright 1254 n'était pas installable (téléchargement refusé) ; l'e2e a tourné avec le Chromium 1243 présent, exposé sous le nom `chromium-1254` par lien symbolique dans le répertoire temporaire de l'agent (`PLAYWRIGHT_BROWSERS_PATH`). Aucun code du dépôt modifié.

## Matrice SC → tâche → test → statut
Tests : `U` = `tests/unit/`, `E` = `tests/e2e/` (liste exécutée dans la vérification, titres portant « SC-xxx »).

| SC | Tâche | Test | Preuve | Statut |
|---|---|---|---|---|
| SC-001 | T-301, T-305 | U `tableauDeBord.test.ts` ; E `refonte-tableau-de-bord.spec.ts` | `npm test` vert ; e2e : 6 tests SC-001 ✓ (collection vide, répartition, pastille) | ✅ |
| SC-002 | T-302, T-314, T-306, T-317, T-901 | U `progression.test.ts`, `familles.test.ts`, `statut-synchro-ecriture.test.ts` ; E `refonte-synchro`, `refonte-bandeau`, `synchro-auto` | 19 tests e2e SC-002 ✓ ; texte « N / M actions » (`progression.ts:46,51`) ; `precedent` monotone testé. Reste consigné (retouches) : barres d'étape de l'onglet Synchro non monotones (`ProgressionSynchro.tsx:40`, précédent non passé) | ✅ (réserve mineure) |
| SC-003 | T-302, T-306 | U `progression.test.ts`, `lot.test.ts` ; E `refonte-synchro.spec.ts` | 5 tests e2e SC-003 ✓ | ✅ |
| SC-004 | T-313, T-307 | U `file-reprise.test.ts`, `pilotage-lots.test.ts`, `etat-execution.test.ts` ; E `refonte-erreur.spec.ts` | 3 tests e2e SC-004 ✓ | ✅ |
| SC-005 | T-313, T-307 | U `file-reprise.test.ts` (aucun `transport` pour une sautée), `reprise.test.ts` ; E `refonte-erreur` | e2e ✓ ; unitaires verts | ✅ |
| SC-006 | T-303, T-313, T-311, T-307 | U `ignorees.test.ts`, `pilotage-lots.test.ts` ; E `refonte-coquille` (purge), `refonte-erreur`, `refonte-lots` | 7 tests e2e SC-006 ✓. Réserve consignée : ignorée d'enchère liée au prix (`ignorees.ts:72,89`) | ✅ (réserve mineure) |
| SC-007 | T-303, T-307, T-310 | U `journal-v2`, `etat-execution`, `statut-synchro`, `ignorees`, `historique`, `affichage`, `confinement-jeton`, `journal-ui` ; E `refonte-transverse`, `refonte-erreur` | validateurs champ par champ, tests verts ; e2e SC-007 ✓ | ✅ |
| SC-008 | T-304, T-307, T-312, T-310 | E `refonte-coquille` (flèches/Origine/Fin), `refonte-erreur`, `refonte-tableau-tri`, `refonte-transverse` (14 tests SC-008 ✓) | e2e. Réserve : test Tab du tableau de tri ne fait que `focus()` (retouches T-312 n°5) | ✅ (réserve mineure) |
| SC-009 | T-304, T-305, T-306, T-308, T-309, T-311, T-318, T-310 | E `refonte-coquille` (6 onglets × 3 largeurs × 2 thèmes), `refonte-captures`, un test par onglet | 42 tests e2e SC-009 ✓ (`scrollWidth ≤ clientWidth`) ; captures `captures/finales/` | ✅ |
| SC-010 | T-304, T-316 | E existants `extension`, `lecture-site`, `assistant`, `sauvegarde`, `plafond-defausse`, `synchro-auto`, `synchro-auto-ui`, `etiquettes`, `synchro-ecriture` ; U `file`, `ordonnanceur`, `journal`, `stockage` | tous ✓ en e2e (sauf l'intermittent perf passé en isolé) ; 1888 unitaires ✓. Non-affaiblissement des assertions non rediffé ligne à ligne : revues de T-304/T-316 | ✅ |
| SC-011 | T-304, T-308, T-312, T-310 | E `refonte-coquille` (Wikipédia/Wikidata), `refonte-transverse` (7), `refonte-collection`, `refonte-tableau-tri` | 13 tests e2e SC-011 ✓ (routes interceptées). Réserve : phase `sans-liste` des 5 000 cartes non vérifiée à zéro requête (retouches T-310) | ✅ (réserve mineure) |
| SC-012 | T-304 | E `refonte-coquille.spec.ts` | 6 tests ✓ (ordre, fragment, Précédent/Suivant, collection illisible) | ✅ |
| SC-013 | T-302, T-317 | E `refonte-bandeau.spec.ts` | 23 tests ✓. Écarts consignés : Pause/Arrêter en ligne à xl, fondu de sortie D-21, mot « Suspendu » (hors texte du SC) | ✅ |
| SC-014 | T-313, T-317 | U `file-pause.test.ts`, `file-reprise.test.ts` (horloge injectée, 15 min) ; E `refonte-bandeau` | tests verts ; e2e Pause/Reprendre/Arrêter ✓ | ✅ |
| SC-015 | T-311 | U `actions.test.ts` ; E `refonte-lots.spec.ts` | 8 tests ✓ | ✅ |
| SC-016 | T-313, T-311, T-307 | U `pilotage-lots`, `reprise`, `synchronisation` ; E `refonte-erreur` (3), `refonte-lots` (4) | e2e ✓ | ✅ |
| SC-017 | T-313, T-307 | U `reprise.test.ts`, `pilotage-lots.test.ts` ; E `refonte-erreur` | 4 tests ✓. Réserve : « Reprise possible à HH:MM » après rechargement (`PanneauErreur.tsx:215`) | ✅ (réserve mineure) |
| SC-018 | T-303, T-307 | U `journal-ui.test.ts`, `journal-v2.test.ts` ; E `refonte-erreur` | 2 tests e2e ✓ | ✅ |
| SC-019 | T-303, T-314 | U `stockage-v2`, `etat-execution`, `journal-v2`, `statut-synchro`, `statut-synchro-ecriture` | `npm test` vert (migration par clé) | ✅ |
| SC-020 | T-303, T-304, T-308 | U `historique.test.ts` ; E `refonte-collection` (4), `refonte-coquille` (2) | e2e ✓ | ✅ |
| SC-021 | T-301, T-308 | U `analyses.test.ts` ; E `refonte-collection` | 4 tests e2e ✓ | ✅ |
| SC-022 | T-301, T-305, T-315 | U `contrastes.test.ts`, `tableauDeBord.test.ts` ; E `refonte-tableau-de-bord` | 6 tests e2e ✓ ; contrastes calculés depuis `tokens.css` ✓ | ✅ |
| SC-023 | T-312 | U `colonnes-tri.test.ts` ; E `refonte-tableau-tri.spec.ts` | 19 tests ✓. Réserves consignées (retouches T-312 : `ami` non effacé, carte rognée au glisser) | ✅ (réserve mineure) |
| SC-024 | T-308, T-311, T-318 | U `ordre-tableau.test.ts` ; E `refonte-collection`, `refonte-lots`, `refonte-ventes` | 23 tests e2e ✓ (`aria-sort`, ordre) | ✅ |
| SC-025 | T-315, T-902 | U `mouvement-tokens.test.ts` ; E `refonte-mouvement.spec.ts` (6 tests : tokens résolus, boutons à 0,2 s, survol 1 px actif / aria-disabled sans survol, chevron et panneau 0,4 s, barre 0,9 s) | ✓ après T-902 (#136) | ✅ |
| SC-026 | T-309, T-312, T-310 | E `refonte-reglages` (3), `refonte-tableau-tri` (1), `refonte-transverse` (9) | 13 tests ✓. Réserve : FLIP non observé (`getAnimations`) dans le tableau de tri | ✅ (réserve mineure) |
| SC-027 | T-305, T-315 | E `refonte-tableau-de-bord.spec.ts` (3), U `primitives.test.ts` | ✓ | ✅ |
| SC-028 | T-309, T-306 | E `refonte-reglages` (11), `refonte-synchro` (4) | ✓ | ✅ |

## Écarts
| SC | Constat | Tâche à rouvrir |
|---|---|---|
| SC-025 | Corrigé par T-902 (#136) : règle de survol des cliquables en `--d-fast`, e2e ajouté. Reste : renommer `duree()` en `styleCalcule` dans `refonte-mouvement.spec.ts` (mineur). | résolu |

## Points consignés non bloquants (`retouches.md`, inchangés)
Barres d'étape Synchro non monotones, alerte d'écriture d'`execution` non effacée, rappel de l'heure de fin de pause après rechargement, perf 5 000 cartes intermittente en suite complète, plus les listes détaillées par PR.

## Captures
`specs/refonte-ihm/captures/finales/refonte-<onglet>-<light|dark>-<mobile|tablet|desktop>.png` (48 fichiers : 6 onglets + tableau de tri × 3 largeurs × 2 thèmes), générées par `refonte-captures.spec.ts` sur ce commit. Captures par tâche : `captures/T-307/`, `captures/T-309/`.
