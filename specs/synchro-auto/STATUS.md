# STATUS — synchro-auto

- **Besoin** : « synchronisation WikiMasters vers l'extension 100 % automatique, sans navigation de ma part » (Alexis, 2026-11-09) : collection, étiquettes, prix du marché.
- **Étape courante** : terminé (vérification faite, voir `verification.md`)
- **Mis à jour** : 2026-11-09 22:00

## Gate spec
- [x] Spec validée par Alexis — date : 2026-11-09 — termes : « oui » (via le chat du projet, après résumé : collection, étiquettes et prix du marché, onglet ouvert, 6 s, arrêt immédiat, interrupteur désactivé par défaut)
- [x] Risque lié à la lecture automatique de `/api/` assumé — 2026-11-09 — « oui »
- [x] Onglet WikiMasters ouvert accepté — 2026-11-09 — « oui »
- [x] Relevés faits dans Chrome le 2026-11-09 (`releve-api.md`) : collection, stats, étiquettes, authentification par cookies, prix du marché (`sales?scope=summary`, sans PRO)

## Planification
- [x] spec.md · [x] spec.refined.md · [x] design.md · [x] plan.md · [x] tasks.md · [x] PR des artefacts mergée (#25)

## Décisions par défaut
- 2026-11-09 — H1 à H5 de `spec.md` adoptées.
- 2026-11-09 — `spec.refined.md` = `spec.md` validée (aucune hypothèse bloquante).

## Tâches
| Tâche | Vague | Agent | Branche | Worktree | PR | Itération | CI | Revue | Sécurité | Statut |
|---|---|---|---|---|---|---|---|---|---|---|
| T-201 | V1 | dev-core | `feat/T-201-lecture-api` | supprimé | #39 | — | verte | APPROVED | APPROVED | mergée |
| T-202 | V1 | dev-core | `feat/T-202-schema-synchro` | supprimé | #42 | — | verte | APPROVED | APPROVED | mergée |
| T-203 | V2 | dev-core | `feat/T-203-ordonnanceur` | supprimé | #44 | — | verte | APPROVED | APPROVED | mergée |
| T-204 | V2 | dev-core | `feat/T-204-ecarts` | supprimé | #43 | — | verte | APPROVED | APPROVED | mergée |
| T-205 | V3 | dev-core | `feat/T-205-executeur` | supprimé | #47 | — | verte | APPROVED | APPROVED | mergée |
| T-206 | V4 | dev-ui | `feat/T-206-interface` | supprimé | #48 | — | verte | APPROVED | APPROVED | mergée |
| T-207 | V5 | dev-test | `feat/T-207-e2e` | supprimé | #50 | — | verte | APPROVED | APPROVED | mergée |
| T-208 | V6 | dev-core | `feat/T-208-docs` | supprimé | #51 | — | verte | APPROVED | APPROVED | mergée |
| T-901 | V7 | dev-core | `feat/T-901-retouches` | supprimé | #52 | — | verte | APPROVED | APPROVED | mergée |

Autres PR mergées : #25 (spec, design, plan, tâches), #27 (règle du bloc « Ce dont j'ai besoin de toi »).

Statuts : à-faire · tests-écrits · en-revue · changements-demandés · mergée · escalade

## Mineurs à reprendre
| PR | fichier:ligne | Point | Suite (T-9xx ou décliné + raison) |
|---|---|---|---|
| #52 | `src/lib/lectureApi.ts` | `couleur` des étiquettes non validée | Décliné : champ non affiché, donc sans effet. |
| #52 | `src/lib/lectureApi.ts` | `analyserPrix` ignore `isPro` | Décliné : inutile sans compte PRO. |
| #52 | `tests/unit/ecarts.test.ts` | Assertion sur les thèmes absente | Décliné : couvert par d'autres tests. |
| #52 | `src/lib/ordonnanceur.ts:347` | `triStable` jamais prouvé en réel (SC-004 partiel) | Résolu le 2026-11-10 (PR #54) : arrêt anticipé activé par `sort=added`, avec repli sur la lecture complète. |
| #52 | `AGENTS.md`, `README.md`, `releve-api.md`, e2e, `lecteur.ts`, `ordonnanceur.ts`, `synchroAuto.ts` | Retouches 1 à 7 | Reprises dans T-901 (`RARETES` exportée depuis `lecteur.ts`). |
| vérif. | `src/content/synchroAuto.ts:218` | Libellé « stockage indisponible » trop précis | Non repris : hors périmètre de la PR de vérification ; à prévoir dans une prochaine retouche. |
| vérif. | `specs/synchro-auto/releve-api.md` | Formes d'erreur 401 et 429 non relevées (SC-001) | Non repris : aucun effet, le code lit le statut seul. |

## Journal
- 2026-11-09 16:00 — Spec brouillon rédigée.
- 2026-11-09 16:45 — Relevés Chrome ; spec complète.
- 2026-11-09 17:00 — Spec validée par Alexis ; design, plan et tasks rédigés.
- 2026-11-09 18:00 à 21:00 — Tâches T-201 à T-208 et retouches T-901 mergées (#39, #42 à #44, #47, #48, #50 à #52).
- 2026-11-09 22:00 — Vérification sur `db855af` : check, build et e2e verts ; 12 SC ✅, SC-001 et SC-004 ⚠️ partiels (aucun ❌). Feature terminée.
