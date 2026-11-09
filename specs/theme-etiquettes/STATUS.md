# STATUS — theme-etiquettes

- **Besoin** : « Thèmes précis et étiquettes de thème sur le site » (Alexis, 2026-11-08) : étendre `src/lib/themes.ts` (pont, tunnel, chien, chat, cheval…), garder la cohérence avec l’assistant de tri (Garder / Échanger + nom de l’ami), et poser les thèmes précis comme étiquettes sur le site (« Thème · chien ») en plus de « Statut · … » et « Ami · … ».
- **Étape courante** : 2-planification (artefacts prêts, PR ouverte)
- **Mis à jour** : 2026-11-09 15:50

## Gate spec
- [x] Spec validée par Alexis — date : 2026-11-08 — termes : « Je valide la spec » (après résumé avec 4 points à trancher : H1 thème = étiquette parents compris, H14 forme « #À échanger Léa », H15 remplacement de « Ami · nom », H9 homonymes)

## Planification
- [x] spec.md · [x] spec.refined.md · [x] design.md · [x] plan.md · [x] tasks.md · [ ] PR des artefacts mergée (#…)

## Décisions par défaut
Hypothèses non bloquantes de `refine`, adoptées sans question.
- 2026-11-08 — Décision d’Alexis (question posée en session) : les thèmes précis deviennent AUSSI des étiquettes sur le site, en plus des étiquettes Statut et Ami.

- 2026-11-09 — Demande d’Alexis : Benjamin aime « barrages » et « Tibet », Anatole aime « Ukraine ». Thèmes `tibet` et `ukraine` ajoutés (60 au total), `barrage` élargi au pluriel ; SC-023 à SC-025.
- 2026-11-09 — H17 : amis initiaux dans `src/config/amis.ts`, inscrits aux préférences seulement au premier usage ; des préférences déjà stockées ne sont pas modifiées (Alexis coche les thèmes dans l’assistant).
- 2026-11-09 — H18 à H20 : voir `spec.refined.md`. Les crochets de « #À échanger [nom ami] » sont lus comme un emplacement (H14 validée au gate).

## Tâches
| Tâche | Vague | Agent | Branche | Worktree | PR | Itération | CI | Revue | Sécurité | Statut |
|---|---|---|---|---|---|---|---|---|---|---|
| T-101 | V1 | dev-core | — | — | — | 0 | — | — | — | à-faire |
| T-102 | V1 | dev-core | — | — | — | 0 | — | — | — | à-faire |
| T-103 | V2 | dev-core | — | — | — | 0 | — | — | — | à-faire |
| T-104 | V3 | dev-core | — | — | — | 0 | — | — | — | à-faire |
| T-107 | V3 | dev-core | — | — | — | 0 | — | — | — | à-faire |
| T-105 | V4 | dev-core | — | — | — | 0 | — | — | — | à-faire |
| T-106 | V4 | dev-core | — | — | — | 0 | — | — | — | à-faire |
| T-108 | V5 | dev-ui | — | — | — | 0 | — | — | — | à-faire |
| T-109 | V6 | dev-test | — | — | — | 0 | — | — | — | à-faire |
| T-110 | V6 | dev-core | — | — | — | 0 | — | — | — | à-faire |

Statuts : à-faire · tests-écrits · en-revue · changements-demandés · mergée · escalade

## Mineurs à reprendre
| PR | fichier:ligne | Point | Suite (T-9xx ou décliné + raison) |
|---|---|---|---|

## Vérification
- [ ] verification.md (#PR …) — écarts : …

## Livraison
- [ ] PR vers `main` (#…) — SHA : …
- [ ] Branches et worktrees du run supprimés

## Journal
- 2026-11-08 — Démarrage. Prérequis : `gh` authentifié ; main à `f7c5c43`. Le réglage `delete_branch_on_merge` n’a pas pu être lu (appel `gh api` refusé par l’environnement) ; les merges précédents du dépôt ont bien supprimé leurs branches distantes. Dépendance : le pose réelle des étiquettes est le lot T-024 de `synchro-complete`, bloqué par des relevés.
- 2026-11-09 15:50 — Planification terminée (spec.refined, design, plan, tasks) sur la branche `claude/project-thread-t6aykt`. La PR des artefacts attend la CI et la revue de sécurité ; l’exécution des tâches n’est pas lancée.
