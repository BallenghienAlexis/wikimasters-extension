# STATUS — synchro-auto

- **Besoin** : « synchronisation WikiMasters vers l'extension 100 % automatique, sans navigation de ma part » (Alexis, 2026-11-09) : collection, étiquettes, prix du marché.
- **Étape courante** : 2-planification (artefacts prêts, PR ouverte)
- **Mis à jour** : 2026-11-09 17:00

## Gate spec
- [x] Spec validée par Alexis — date : 2026-11-09 — termes : « oui » (via le chat du projet, après résumé : collection, étiquettes et prix du marché, onglet ouvert, 6 s, arrêt immédiat, interrupteur désactivé par défaut)
- [x] Risque lié à la lecture automatique de `/api/` assumé — 2026-11-09 — « oui »
- [x] Onglet WikiMasters ouvert accepté — 2026-11-09 — « oui »
- [x] Relevés faits dans Chrome le 2026-11-09 (`releve-api.md`) : collection, stats, étiquettes, authentification par cookies, prix du marché (`sales?scope=summary`, sans PRO)

## Planification
- [x] spec.md · [x] spec.refined.md · [x] design.md · [x] plan.md · [x] tasks.md · [ ] PR des artefacts mergée (#25)

## Décisions par défaut
- 2026-11-09 — H1 à H5 de `spec.md` adoptées.
- 2026-11-09 — `spec.refined.md` = `spec.md` validée (aucune hypothèse bloquante).

## Tâches
| Tâche | Vague | Agent | Branche | Worktree | PR | Itération | CI | Revue | Sécurité | Statut |
|---|---|---|---|---|---|---|---|---|---|---|
| T-901 | src/lib/lectureApi.ts | `couleur` des étiquettes non validée | Décliné : champ non affiché, donc sans effet. |
| T-901 | src/lib/lectureApi.ts | `analyserPrix` ignore `isPro` | Décliné : inutile sans compte PRO. |
| T-901 | tests/unit/ecarts.test.ts | Assertion sur les thèmes absente | Décliné : couvert par d'autres tests. |
| T-901 | src/lib/ordonnanceur.ts | `triStable` jamais prouvé en réel | Décliné : optimisation non activée, sûre par défaut. |
| T-901 | AGENTS.md, README.md, releve-api.md, e2e, lecteur.ts, ordonnanceur.ts, synchroAuto.ts | Retouches 1 à 7 | Faites dans T-901 (RARETES était dupliquée : exportée depuis `lecteur.ts`). |
| T-201 | V1 | dev-core | — | — | — | 0 | — | — | — | à-faire |
| T-202 | V1 | dev-core | — | — | — | 0 | — | — | — | à-faire |
| T-203 | V2 | dev-core | — | — | — | 0 | — | — | — | à-faire |
| T-204 | V2 | dev-core | — | — | — | 0 | — | — | — | à-faire |
| T-205 | V3 | dev-core | — | — | — | 0 | — | — | — | à-faire |
| T-206 | V4 | dev-ui | — | — | — | 0 | — | — | — | à-faire |
| T-207 | V5 | dev-test | — | — | — | 0 | — | — | — | à-faire |
| T-208 | V6 | dev-core | — | — | — | 0 | — | — | — | à-faire |

Statuts : à-faire · tests-écrits · en-revue · changements-demandés · mergée · escalade

## Mineurs à reprendre
| PR | fichier:ligne | Point | Suite (T-9xx ou décliné + raison) |
|---|---|---|---|

## Journal
- 2026-11-09 16:00 — Spec brouillon rédigée.
- 2026-11-09 16:45 — Relevés Chrome ; spec complète.
- 2026-11-09 17:00 — Spec validée par Alexis ; design, plan et tasks rédigés.
