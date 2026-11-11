# STATUS — theme-etiquettes

- **Besoin** : « Thèmes précis et étiquettes de thème sur le site » (Alexis, 2026-11-08) : étendre `src/lib/themes.ts` (pont, tunnel, chien, chat, cheval…), garder la cohérence avec l’assistant de tri (Garder / Échanger + nom de l’ami), et poser les thèmes précis comme étiquettes sur le site (« #Chien », sans préfixe « Thème · », décision d’Alexis du 2026-11-08) en plus de « Statut · … » et « Ami · … ».
- **Étape courante** : 5-vérification (tâches T-101 à T-110 et T-901 à T-903 mergées, T-904 en PR)
- **Mis à jour** : 2026-11-09 21:10

## Gate spec
- [x] Spec validée par Alexis — date : 2026-11-08 — termes : « Je valide la spec » (après résumé avec 4 points à trancher : H1 thème = étiquette parents compris, H14 forme « #À échanger Léa », H15 remplacement de « Ami · nom », H9 homonymes)

## Planification
- [x] spec.md · [x] spec.refined.md · [x] design.md · [x] plan.md · [x] tasks.md · [x] PR des artefacts mergée (#24)

## Décisions par défaut
Hypothèses non bloquantes de `refine`, adoptées sans question.
- 2026-11-08 — Décision d’Alexis (question posée en session) : les thèmes précis deviennent AUSSI des étiquettes sur le site, en plus des étiquettes Statut et Ami.

- 2026-11-09 — Demande d’Alexis : Benjamin aime « barrages » et « Tibet », Anatole aime « Ukraine ». Thèmes `tibet` et `ukraine` ajoutés (60 au total), `barrage` élargi au pluriel ; SC-023 à SC-025.
- 2026-11-09 — H17 (décision d’Alexis) : amis initiaux dans `src/config/amis.ts`, fusionnés automatiquement une seule fois dans les préférences, y compris déjà stockées, sans rien retirer.
- 2026-11-09 — H18 à H20 : voir `spec.refined.md`. Les crochets de « #À échanger [nom ami] » sont lus comme un emplacement (H14 validée au gate).

## Tâches
| Tâche | Vague | Agent | Branche | Worktree | PR | Itération | CI | Revue | Sécurité | Statut |
|---|---|---|---|---|---|---|---|---|---|---|
| T-101 | V1 | dev-core | — | — | #28 | — | verte | APPROVED | APPROVED | mergée |
| T-102 | V1 | dev-core | — | — | #29 | — | verte | APPROVED | APPROVED | mergée |
| T-103 | V2 | dev-core | — | — | #30 | — | verte | APPROVED | APPROVED | mergée |
| T-104 | V3 | dev-core | — | — | #31 | — | verte | APPROVED | APPROVED | mergée |
| T-107 | V3 | dev-core | — | — | #32 | — | verte | APPROVED | APPROVED | mergée |
| T-105 | V4 | dev-core | — | — | #33 | — | verte | APPROVED | APPROVED | mergée |
| T-106 | V4 | dev-core | — | — | #34 | — | verte | APPROVED | APPROVED | mergée |
| T-108 | V5 | dev-ui | — | — | #41 | — | verte | APPROVED | APPROVED | mergée |
| T-109 | V6 | dev-test | — | — | #45 | — | verte | APPROVED | APPROVED | mergée |
| T-110 | V6 | dev-core | — | — | #37 | — | verte | APPROVED | APPROVED | mergée |
| T-901 | — | dev-core | — | — | #35 | — | verte | APPROVED | APPROVED | mergée |
| T-902 | — | dev-core | — | — | #36 | — | verte | APPROVED | APPROVED | mergée |
| T-903 | — | dev-core | — | — | #46 | — | verte | APPROVED | APPROVED | mergée |
| T-904 | — | dev-core | feat/T-904-retouches | .worktrees/T-904-retouches | #49 | 0 | — | — | — | en-revue |

Statuts : à-faire · tests-écrits · en-revue · changements-demandés · mergée · escalade

## Mineurs à reprendre
| PR | fichier:ligne | Point | Suite (T-9xx ou décliné + raison) |
|---|---|---|---|

## Vérification
- [x] verification.md (PR T-904) — écarts : aucun bloquant (SC-015 : texte de l’avertissement vérifié, visibilité réelle non relevée, attendu)

## Livraison
- [ ] PR vers `main` (#…) — SHA : …
- [ ] Branches et worktrees du run supprimés

## Journal
- 2026-11-08 — Démarrage. Prérequis : `gh` authentifié ; main à `f7c5c43`. Le réglage `delete_branch_on_merge` n’a pas pu être lu (appel `gh api` refusé par l’environnement) ; les merges précédents du dépôt ont bien supprimé leurs branches distantes. Dépendance : le pose réelle des étiquettes est le lot T-024 de `synchro-complete`, bloqué par des relevés.
- 2026-11-09 15:50 — Planification terminée (spec.refined, design, plan, tasks) sur la branche `claude/project-thread-t6aykt`. La PR des artefacts attend la CI et la revue de sécurité ; l’exécution des tâches n’est pas lancée.
- 2026-11-09 21:10 — T-101 à T-110 et T-901 à T-903 mergées sur `main` (f33ef11). T-904 (retouches des mineurs de revue) et `verification.md` dans la même PR.
